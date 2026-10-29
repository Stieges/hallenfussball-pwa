-- supabase/migrations/20261118_004_abschluss_nachzug.sql
-- W-M „Server-Nachzug Abschluss“ (plan-R3-abschluss-v3.md § 2 „W-M – kleine Server-Migration nach R3“, V1, S3; Pflicht vor
-- der Probe 20.11.). Drei Nachträge zu A-21a-S (20261113_003) und A-35 (20261117_005):
--   (a) PFLICHT – Klärungsliste hält den Abschluss am Server auf (Befund C-ABSCHLUSS-OHNE-KLAERUNG): finish_open_items
--       meldet jeden offenen Eintrag der Klärungsliste als Punkt {kind 'review_open', eventId, matchId, matchNumber, field};
--       finish_preflight zeigt ihn, finish_tournament lehnt mit OPEN_ITEMS ab. Offen = match_reviews.kind 'review' ohne
--       gültige Entscheidung (REVIEW_ACCEPT/REVIEW_DISCARD mit target_event_id = event_id und review_state NULL) – dieselbe
--       Lesart wie list_match_reviews („decision null“). Schließt die Lücke zwischen list_match_reviews und
--       finish_tournament (STALE_STATE vergleicht nur matches-Spalten; ein danach offener Eintrag wäre unentscheidbar).
--   (b) Kindermodus im öffentlichen Endstand (Befund C-ENDSTAND-KINDERMODUS-OEFFENTLICH): final_standings_payload liefert
--       bei eingeschaltetem Kindermodus (config.hideScoresForPublic = JSON true, gelesen über public_view.switches wie
--       public_payload) {status:'none'} – keine Plätze, keine Torschützen, auch nicht mit Torschützen-Schalter.
--       Wirkt für public_final_standings (Zuschauer) und display_final_standings (Monitor). „none“ statt eines eigenen
--       Status: die Zuschauer-/Monitor-Ansicht kennt Zustand und Kindermodus schon aus public_payload (E7) und zeigt
--       „Turnier beendet – danke fürs Mitspielen“; ein neuer Status wäre für die vorhandenen Leser unlesbar.
--   (c) list_late_entries(uuid) (Befund C-LATE-ENTRIES-OHNE-NAMEN): Einträge „nach dem Ende eingetroffen“ mit Namen wie
--       list_match_reviews (author = Mitgliederliste/Profilname über actor_name, deviceLabel = Gerätename aus dem
--       Helfer-Beitritt, sonst aus der Feldsteuerung; nie eine E-Mail). Nur Turnierleitung (manageLifecycle, wie die
--       RLS-Policy late_entries_select), sonst [].
-- Szenarien: @LZ-008, @LZ-009, @LZ-010 (Zeile „in der Klärungsliste ist ein Eintrag … offen“), @LZ-012, @LZ-039;
--   @ZM-121 (Zeile „Bambini-Cup mit eingeschaltetem Kindermodus“), Record ZM „Kindermodus überstimmt alle Schalter“ und
--   „Zuschauer und Monitor erhalten nur, was sie anzeigen dürfen“.
--
-- Inhalt: NUR CREATE OR REPLACE match_engine.finish_open_items (Text aus 20261113_003 wörtlich + Block 5),
--   CREATE OR REPLACE match_engine.final_standings_payload (Text aus 20261113_003 + eine Bedingung) und neu
--   public.list_late_entries (SECURITY DEFINER, EXECUTE nur authenticated). Keine Tabelle, keine Policy, kein Trigger.
--   append_match_events und closed_intake bleiben unberührt (Abgleich R2-M2, Anhang B: R2-M2 = 20261118_003 fasst
--   append_match_events neu und übernimmt closed_intake selbst; finish_open_items fasst es nicht an).
-- Fail-fast (S3): finish_open_items und final_standings_payload nur in der Fassung 20261113_003 (md5 des Funktionstexts)
--   oder in der Fassung dieser Datei; match_reviews in der Form aus 20261117_005; list_match_reviews mit derselben Lesart
--   „offen“. Sonst Abbruch ohne Änderung („erst klären“) – nie still eine andere Fassung überschreiben.
--
-- Voraussetzung: 20261113_003 (A-21a-S), 20261117_005 (A-35), 20261117_104 (B-14, public_view.switches). Idempotent
--   (CREATE OR REPLACE, REVOKE/GRANT). Bestandsdaten: keine Änderung.
-- Reihenfolge: VOR dem Merge des App-Teils live (die App liest den Punkt review_open dann vom Server).
-- RÜCKWEG: supabase/rollbacks/20261118_004_abschluss_nachzug_rollback.sql (= `bash scripts/abschluss-nachzug-check.sh
--   --print-rueckweg`), EIN Block; beide Funktionen wörtlich aus 20261113_003 zurück, list_late_entries weg.
-- Beweis: scripts/abschluss-nachzug-check.sh (Wegwerf-Container), RLS-Matrix scripts/rls-matrix.d/spur-z-abschluss-nachzug.sh.
-- Produktion: Einspielen durch Daniel per CLI nach Freigabe; dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Änderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_items   text;
  v_payload text;
  v_reviews text;
BEGIN
  IF to_regclass('public.match_reviews') IS NULL OR to_regclass('public.late_entries') IS NULL
     OR to_regclass('public.match_events') IS NULL OR to_regclass('public.tournament_join_requests') IS NULL
     OR to_regclass('public.field_control') IS NULL
     OR to_regprocedure('match_engine.finish_open_items(uuid)') IS NULL
     OR to_regprocedure('match_engine.final_standings_payload(public.tournaments)') IS NULL
     OR to_regprocedure('match_engine.actor_name(uuid,uuid)') IS NULL
     OR to_regprocedure('public_view.switches(jsonb)') IS NULL
     OR to_regprocedure('public.list_match_reviews(uuid)') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'co-admin' AND permission = 'manageLifecycle') THEN
    RAISE EXCEPTION '20261118_004_abschluss_nachzug: Voraussetzungen fehlen – zuerst 20261113_003, 20261117_104 und 20261117_005 einspielen';
  END IF;
  -- match_reviews in der Form aus 20261117_005 (Eintrag = event_id, Art review/notice, Feld, Zeitpunkt)
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'match_reviews'
         AND column_name IN ('event_id', 'tournament_id', 'match_id', 'field', 'kind', 'created_at')) <> 6
     OR NOT EXISTS (SELECT 1 FROM pg_constraint c
                     WHERE c.conrelid = 'public.match_reviews'::regclass AND c.contype = 'c'
                       AND pg_get_constraintdef(c.oid) LIKE '%''review''%''notice''%') THEN
    RAISE EXCEPTION '20261118_004_abschluss_nachzug: match_reviews hat eine unbekannte Form (erwartet 20261117_005) – erst klären';
  END IF;
  -- list_match_reviews: dieselbe Lesart „entschieden“ (REVIEW_ACCEPT/REVIEW_DISCARD, gültig = review_state NULL)
  SELECT prosrc INTO v_reviews FROM pg_proc WHERE oid = to_regprocedure('public.list_match_reviews(uuid)');
  IF position('d.type IN (''REVIEW_ACCEPT'', ''REVIEW_DISCARD'')' IN v_reviews) = 0
     OR position('d.target_event_id = r.event_id' IN v_reviews) = 0
     OR position('AND d.review_state IS NULL' IN v_reviews) = 0 THEN
    RAISE EXCEPTION '20261118_004_abschluss_nachzug: list_match_reviews hat eine unbekannte Fassung (erwartet 20261117_005) – erst klären';
  END IF;
  -- finish_open_items: Fassung 20261113_003 oder diese Datei (Kennzeichen „W-M (a)“ im Text)
  SELECT prosrc INTO v_items FROM pg_proc WHERE oid = to_regprocedure('match_engine.finish_open_items(uuid)');
  IF md5(v_items) <> '99f83e8f2d6528beb86bbd204570d8fb' AND position('W-M (a)' IN v_items) = 0 THEN
    RAISE EXCEPTION '20261118_004_abschluss_nachzug: finish_open_items hat eine unbekannte Fassung (erwartet 20261113_003) – erst klären';
  END IF;
  -- final_standings_payload: Fassung 20261113_003 oder diese Datei (Kennzeichen „W-M (b)“ im Text)
  SELECT prosrc INTO v_payload FROM pg_proc WHERE oid = to_regprocedure('match_engine.final_standings_payload(public.tournaments)');
  IF md5(v_payload) <> '89a31587230673efa83cfa19e02bac85' AND position('W-M (b)' IN v_payload) = 0 THEN
    RAISE EXCEPTION '20261118_004_abschluss_nachzug: final_standings_payload hat eine unbekannte Fassung (erwartet 20261113_003) – erst klären';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. (a) Offene Punkte vor dem Abschluss: Text aus 20261113_003 wörtlich, dazu Block 5 (Klärungsliste)
-- ---------------------------------------------------------------------------------------------------------------
-- Offene Punkte vor dem Abschluss (R-EA-7, @LZ-010, @LZ-012, @LZ-013, Review #332 H3). Ein Spiel ist entschieden, wenn es
-- beendet oder „nicht ausgetragen“ ist; ein beendetes Finalrunden-Spiel braucht zusätzlich einen Sieger (oder eine
-- Wertung). Gruppen: jede Gruppe (Jeder gegen jeden = '') braucht einen geltenden Abschluss; nach einer Korrektur
-- „Besetzung prüfen“ (group_stale); mit offenen Plätzen nach dem Neu-Abschluss ein offener Gleichstand (tie_open).
-- W-M (a): offene Einträge der Klärungsliste (review_open, @LZ-008, @LZ-010 Z. 4, @LZ-012).
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
      UNION ALL
      -- W-M (a): offene Einträge der Klärungsliste (A-35): kind 'review' ohne gültige Entscheidung -- dieselbe Lesart wie
      -- list_match_reviews („decision null“). Hinweise (kind 'notice') zählen schon und halten nicht auf. Reihenfolge wie
      -- die Klärungsliste (Eingang, dann Kennung).
      SELECT 5, lpad(floor(extract(epoch FROM r.created_at) * 1000000)::bigint::text, 20, '0') || r.event_id::text,
             jsonb_strip_nulls(jsonb_build_object('kind', 'review_open', 'eventId', r.event_id, 'matchId', r.match_id,
                                                  'matchNumber', m.match_number, 'field', r.field))
        FROM public.match_reviews r
        JOIN public.matches m ON m.id = r.match_id
       WHERE r.tournament_id = p_tournament_id AND r.kind = 'review'
         AND NOT EXISTS (SELECT 1 FROM public.match_events d
                          WHERE d.target_event_id = r.event_id AND d.type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD')
                            AND d.review_state IS NULL)
    ) x;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. (b) Gespeicherter Endstand für Zuschauer und Monitor: Text aus 20261113_003, dazu die Kindermodus-Bedingung
-- ---------------------------------------------------------------------------------------------------------------
-- Gespeicherter Endstand für Zuschauer und Monitor (R-EA-3, R-EA-9, @LZ-074, @LZ-075, @LZ-076, @ZM-011, @ZM-012):
-- nur nach dem Abschluss ('finished'), Torschützen nur mit config.publicScorers = true. Sonst {status:'none'} (auch für
-- unbekannte oder nicht freigegebene Turniere: kein Existenz-Orakel). W-M (b): im Kindermodus (@ZM-121 Zeile
-- „Bambini-Cup“, „Kindermodus überstimmt alle Schalter“) ebenfalls {status:'none'} -- keine Plätze, keine Torschützen.
CREATE OR REPLACE FUNCTION match_engine.final_standings_payload(p_tournament public.tournaments) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_tournament.id IS NULL OR p_tournament.deleted_at IS NOT NULL
         OR p_tournament.lifecycle_status IS DISTINCT FROM 'finished' OR fs.snapshot IS NULL
         -- W-M (b): Kindermodus überstimmt alle Schalter (gleiche Lesart wie public_payload)
         OR (public_view.switches(p_tournament.config) ->> 'kidsMode')::boolean
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

-- ---------------------------------------------------------------------------------------------------------------
-- 3. (c) RPC list_late_entries: „nach dem Ende eingetroffen“ mit Namen (@LZ-039, E8). Nur Turnierleitung
--    (manageLifecycle, wie late_entries_select), sonst []. Je Eintrag Spiel, Eingang, Person/Gerät als Name (nie
--    E-Mail) und der Eintrag selbst (Typ, Team, Abschnitt, Spielzeit, Angaben, Gerätezeit) wie list_match_reviews.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_late_entries(p_tournament_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', le.id,
           'eventId', le.event_id,
           'matchId', le.match_id,
           'matchNumber', m.match_number,
           'field', m.field,
           'receivedAt', floor(extract(epoch FROM le.received_at) * 1000)::bigint,
           'author', match_engine.actor_name(le.tournament_id, le.actor),
           'deviceLabel', coalesce(
             (SELECT jr.device_label FROM public.tournament_join_requests jr
               WHERE jr.tournament_id = le.tournament_id AND jr.device_user_id = le.actor AND jr.status = 'accepted'
               LIMIT 1),
             (SELECT fc.holder_device_label FROM public.field_control fc
               WHERE fc.tournament_id = le.tournament_id AND le.device_id IS NOT NULL
                 AND fc.holder_device_id = le.device_id AND fc.holder_device_label IS NOT NULL
               ORDER BY fc.field LIMIT 1)),
           'entry', jsonb_build_object('type', le.event -> 'type', 'teamId', le.event -> 'teamId',
                                       'section', le.event -> 'section', 'clockMs', le.event -> 'clockMs',
                                       'payload', le.event -> 'payload', 'targetId', le.event -> 'targetId',
                                       'deviceAt', le.event -> 'at')
         ) ORDER BY le.received_at, le.id), '[]'::jsonb)
    FROM public.late_entries le
    JOIN public.matches m ON m.id = le.match_id
    JOIN public.tournaments t ON t.id = le.tournament_id AND t.deleted_at IS NULL
   WHERE le.tournament_id = p_tournament_id
     AND public.has_tournament_permission(p_tournament_id, 'manageLifecycle');
$$;
COMMENT ON FUNCTION public.list_late_entries(uuid) IS
  'W-M (c) (@LZ-039, @LZ-040, E8): Einträge „nach dem Ende eingetroffen“ mit Namen (Mitgliederliste/Profil, Gerätename; nie E-Mail). Nur Turnierleitung (manageLifecycle), sonst [].';
REVOKE ALL ON FUNCTION public.list_late_entries(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_late_entries(uuid) TO authenticated;

COMMIT;
