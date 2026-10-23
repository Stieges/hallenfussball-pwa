-- scripts/lib/group-completion-harness.sql — Hilfen (Schema "harness") fuer scripts/group-completion-check.sh (A-13b-S).
-- NUR im Wegwerf-Container; nie in eine echte Datenbank einspielen. Identitaeten wie PostgREST (request.jwt.claims,
-- Rolle authenticated); Turniere aus der Fixture src/core/standings/__fixtures__/group-state.json (echt erzeugte Zeilen),
-- Ergebnisse ueber append_match_events (RESULT_ENTRY/CORRECTION), Kopien je Probe ueber harness.clone.
-- Die Hilfen werden VOR 20261110_006 angelegt (Fail-fast-Probe, Gegenprobe ohne Migration): Rumpf erst beim Aufruf pruefen.
SET check_function_bodies = off;
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
CREATE TABLE harness.doc (name text PRIMARY KEY, doc jsonb NOT NULL);
CREATE TABLE harness.lastres (k int PRIMARY KEY DEFAULT 1, res jsonb);
INSERT INTO harness.lastres (k, res) VALUES (1, NULL);
GRANT ALL ON ALL TABLES IN SCHEMA harness TO anon, authenticated, service_role;

CREATE FUNCTION harness.u(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $fn$ SELECT md5(p)::uuid $fn$;

CREATE FUNCTION harness.claims(p_user uuid, p_anon boolean, p_role text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE
    json_build_object('sub', p_user, 'role', p_role, 'is_anonymous', coalesce(p_anon, false))::text END, true);
  PERFORM set_config('role', p_role, true);
END;
$fn$;

-- Kurzform eines RPC-Ergebnisses: ok | ok:CODE | rejected:CODE | clarification:CODE | error:SQLSTATE
CREATE FUNCTION harness.short(r jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT coalesce(r ->> 'status', 'kein-status') || coalesce(':' || (r ->> 'code'), '')
$fn$;

-- p_sql als Identitaet (authenticated bzw. anon); Ergebnis jsonb in harness.lastres, Rueckgabe Kurzform.
CREATE FUNCTION harness.rpc(p_user uuid, p_anon boolean, p_sql text, p_role text DEFAULT 'authenticated')
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb; s text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE p_sql INTO v;
    s := harness.short(v);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
    s := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  UPDATE harness.lastres SET res = v WHERE k = 1;
  RETURN s;
END;
$fn$;

-- beliebiges SQL als Identitaet: ok:<Zeilen> | error:SQLSTATE (wie forfeit-check.sh harness.exec)
CREATE FUNCTION harness.exec(p_user uuid, p_anon boolean, p_sql text, p_role text DEFAULT 'authenticated')
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows bigint; v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v := 'ok:' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;

-- Zahl als Identitaet (z. B. sichtbare Zeilen): Text oder error:SQLSTATE
CREATE FUNCTION harness.val(p_user uuid, p_anon boolean, p_sql text, p_role text DEFAULT 'authenticated')
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE p_sql INTO v;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;

-- Zeile einfuegen mit genau den Spalten des JSON (Vorgaben der Tabelle fuer die uebrigen).
CREATE FUNCTION harness.ins(p_table text, p_row jsonb) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(k), ', ') INTO cols FROM jsonb_object_keys(p_row) k;
  EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)',
                 p_table, cols, cols, p_table) USING p_row;
END;
$fn$;

-- Text-Ersetzung aller IDs (neue ID = md5(tag:alt)).
CREATE FUNCTION harness.remap(p jsonb, p_tag text, p_ids text[]) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE t text := p::text; i text;
BEGIN
  IF p_tag IS NULL THEN
    RETURN p;
  END IF;
  FOREACH i IN ARRAY p_ids LOOP
    t := replace(t, i, harness.u(p_tag || ':' || i)::text);
  END LOOP;
  RETURN t::jsonb;
END;
$fn$;

-- Turnier aus der Fixture group-state.json (echt erzeugte Zeilen) anlegen; Mitglieder: Maria (Co-Admin), Tom (Helfer).
CREATE FUNCTION harness.instantiate(p_key text, p_tag text, p_with_results boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql AS $fn$
DECLARE t jsonb; ids text[]; r jsonb; tid uuid;
BEGIN
  SELECT doc -> 'tournaments' -> p_key INTO t FROM harness.doc WHERE name = 'group-state';
  ids := ARRAY[t -> 'tournament' ->> 'id']
      || ARRAY(SELECT x ->> 'id' FROM jsonb_array_elements(t -> 'teams') x)
      || ARRAY(SELECT x ->> 'id' FROM jsonb_array_elements(t -> 'matches') x);
  t := harness.remap(t, p_tag, ids);
  tid := (t -> 'tournament' ->> 'id')::uuid;
  IF EXISTS (SELECT 1 FROM public.tournaments WHERE id = tid) THEN
    RETURN tid;   -- Fixture-Turnier ohne Umbenennung (p_tag NULL) schon angelegt (Gegenprobe: mehrere Varianten)
  END IF;
  PERFORM harness.ins('tournaments', (t -> 'tournament') || jsonb_build_object('version', 1, 'title', coalesce(p_tag, t -> 'tournament' ->> 'title')));
  FOR r IN SELECT x FROM jsonb_array_elements(t -> 'teams') x LOOP PERFORM harness.ins('teams', r); END LOOP;
  FOR r IN SELECT x FROM jsonb_array_elements(t -> 'matches') x LOOP PERFORM harness.ins('matches', r); END LOOP;
  IF p_with_results THEN
    FOR r IN SELECT harness.remap(x, p_tag, ids) FROM harness.doc, jsonb_array_elements(doc -> 'updates') x
              WHERE name = 'group-state' AND x ->> 'tournament' = p_key LOOP
      UPDATE public.matches SET score_a = (r ->> 'score_a')::int, score_b = (r ->> 'score_b')::int,
             match_status = r ->> 'match_status', decided_by = r ->> 'decided_by', forfeit_absent = r ->> 'forfeit_absent'
       WHERE id = (r ->> 'id')::uuid;
    END LOOP;
  END IF;
  INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label)
  SELECT tid, u.id, u.role, now(), u.label
    FROM (SELECT * FROM harness.people WHERE role IS NOT NULL) u;
  RETURN tid;
END;
$fn$;

-- Turnier samt Teams, Spielen, Ereignissen, Mitgliedern kopieren (neue IDs), fuer wiederholte Proben.
CREATE FUNCTION harness.clone(p_src uuid, p_tag text) RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE ids text[]; r jsonb;
BEGIN
  ids := ARRAY[p_src::text]
      || ARRAY(SELECT id::text FROM public.teams WHERE tournament_id = p_src)
      || ARRAY(SELECT id::text FROM public.matches WHERE tournament_id = p_src)
      || ARRAY(SELECT e.id::text FROM public.match_events e JOIN public.matches m ON m.id = e.match_id WHERE m.tournament_id = p_src)
      || ARRAY(SELECT id::text FROM public.tournament_collaborators WHERE tournament_id = p_src);
  PERFORM harness.ins('tournaments', harness.remap(to_jsonb(t) - 'title', p_tag, ids) || jsonb_build_object('title', p_tag))
     FROM public.tournaments t WHERE t.id = p_src;
  FOR r IN SELECT to_jsonb(x) FROM public.teams x WHERE tournament_id = p_src LOOP
    PERFORM harness.ins('teams', harness.remap(r, p_tag, ids)); END LOOP;
  FOR r IN SELECT to_jsonb(x) FROM public.matches x WHERE tournament_id = p_src LOOP
    PERFORM harness.ins('matches', harness.remap(r, p_tag, ids)); END LOOP;
  FOR r IN SELECT to_jsonb(e) FROM public.match_events e JOIN public.matches m ON m.id = e.match_id
            WHERE m.tournament_id = p_src ORDER BY e.match_id, e.seq LOOP
    PERFORM harness.ins('match_events', harness.remap(r - 'seq', p_tag, ids)); END LOOP;
  FOR r IN SELECT to_jsonb(x) FROM public.tournament_collaborators x WHERE tournament_id = p_src LOOP
    PERFORM harness.ins('tournament_collaborators', harness.remap(r, p_tag, ids)); END LOOP;
  RETURN harness.u(p_tag || ':' || p_src::text);
END;
$fn$;

CREATE TABLE harness.people (name text PRIMARY KEY, id uuid NOT NULL, anon boolean NOT NULL, role text, label text);
GRANT ALL ON harness.people TO anon, authenticated, service_role;
CREATE FUNCTION harness.p(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $fn$ SELECT id FROM harness.people WHERE name = p_name $fn$;
CREATE FUNCTION harness.pa(p_name text) RETURNS boolean LANGUAGE sql STABLE AS $fn$ SELECT anon FROM harness.people WHERE name = p_name $fn$;

CREATE FUNCTION harness.team(p_tid uuid, p_name text) RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT id FROM public.teams WHERE tournament_id = p_tid AND name = p_name
$fn$;
CREATE FUNCTION harness.tname(p_id uuid) RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT coalesce((SELECT name FROM public.teams WHERE id = p_id), '-')
$fn$;
CREATE FUNCTION harness.gm(p_tid uuid, p_a text, p_b text) RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT m.id FROM public.matches m
   WHERE m.tournament_id = p_tid AND NOT coalesce(m.is_final, false)
     AND ARRAY[m.team_a_id, m.team_b_id] @> ARRAY[harness.team(p_tid, p_a), harness.team(p_tid, p_b)]
$fn$;
-- Finalspiel nach Herkunft der Heimseite: 'A1' (Halbfinale 1), 'B1' (Halbfinale 2)
CREATE FUNCTION harness.hf(p_tid uuid, p_home text) RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT id FROM public.matches
   WHERE tournament_id = p_tid AND is_final AND origin_a ->> 'kind' = 'groupRank'
     AND (origin_a ->> 'group') || (origin_a ->> 'rank') = p_home
$fn$;
CREATE FUNCTION harness.ranking(p_tid uuid, p_names text) RETURNS uuid[] LANGUAGE sql STABLE AS $fn$
  SELECT array_agg(harness.team(p_tid, btrim(n)) ORDER BY o) FROM unnest(string_to_array(p_names, ',')) WITH ORDINALITY AS x(n, o)
$fn$;

-- Seite eines Spiels: Team|Herkunft (gA2 = Gruppenplatz, mr = Spielergebnis, hand = von Hand gesetzt, - = keine)
CREATE FUNCTION harness.side(p_match uuid, p_side text) RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT harness.tname(CASE WHEN p_side = 'A' THEN team_a_id ELSE team_b_id END) || '|' ||
         CASE WHEN s IS NULL THEN CASE WHEN (CASE WHEN p_side = 'A' THEN team_a_id ELSE team_b_id END) IS NULL THEN '-' ELSE 'hand' END
              WHEN s ->> 'kind' = 'groupRank' THEN (s ->> 'group') || (s ->> 'rank') ELSE 'mr' END
    FROM (SELECT team_a_id, team_b_id, CASE WHEN p_side = 'A' THEN slot_a_source ELSE slot_b_source END AS s
            FROM public.matches WHERE id = p_match) x
$fn$;

CREATE FUNCTION harness.notices(p_tid uuid) RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(string_agg(n.kind || ':' || n.side || ':' || harness.tname(n.origin_team_id) || '/' || harness.tname(n.current_team_id)
                             || CASE WHEN n.resolved_at IS NULL THEN '' ELSE ':erledigt' END, ',' ORDER BY n.id), '')
    FROM public.bracket_notices n WHERE n.tournament_id = p_tid
$fn$;
CREATE FUNCTION harness.logkinds(p_tid uuid) RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(string_agg(kind, ',' ORDER BY id), '') FROM public.bracket_log WHERE tournament_id = p_tid
$fn$;
CREATE FUNCTION harness.gc(p_tid uuid, p_group text) RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT coalesce((SELECT CASE WHEN reopened_at IS NOT NULL THEN 'reopened' WHEN stale THEN 'stale' ELSE 'completed' END
                     FROM public.group_completions WHERE tournament_id = p_tid AND group_id = p_group), 'none')
$fn$;
CREATE FUNCTION harness.state(p_tid uuid, p_group text) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT match_engine.group_state(p_tid, p_group)
$fn$;
CREATE FUNCTION harness.decisions(p_tid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(config -> 'standingDecisions', '[]'::jsonb) FROM public.tournaments WHERE id = p_tid
$fn$;
CREATE FUNCTION harness.tversion(p_tid uuid) RETURNS integer LANGUAGE sql STABLE AS $fn$
  SELECT version FROM public.tournaments WHERE id = p_tid
$fn$;

-- Ergebnis eintragen (RESULT_ENTRY) bzw. korrigieren (CORRECTION, basedOn = letzter Stand) ueber append_match_events
CREATE FUNCTION harness.events(p_person text, p_match uuid, p_events jsonb) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb; s text;
BEGIN
  PERFORM harness.claims(harness.p(p_person), harness.pa(p_person), 'authenticated');
  BEGIN
    v := public.append_match_events(p_match, p_events, 1, NULL);
    s := coalesce((SELECT string_agg(x ->> 'status' || coalesce(':' || (x ->> 'code'), ''), ',') FROM jsonb_array_elements(v -> 'results') x), 'leer');
  EXCEPTION WHEN OTHERS THEN
    s := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN s;
END;
$fn$;
CREATE FUNCTION harness.entry(p_person text, p_tid uuid, p_a text, p_b text, p_sa int, p_sb int) RETURNS text LANGUAGE sql AS $fn$
  SELECT harness.events(p_person, harness.gm(p_tid, p_a, p_b), jsonb_build_array(jsonb_build_object(
    'id', harness.u('entry:' || p_tid || p_a || p_b || clock_timestamp()), 'type', 'RESULT_ENTRY', 'at', 1000,
    'section', NULL, 'clockMs', NULL, 'teamId', NULL, 'targetId', NULL,
    'payload', jsonb_build_object('scores', jsonb_build_object(harness.team(p_tid, p_a), p_sa, harness.team(p_tid, p_b), p_sb)))))
$fn$;
CREATE FUNCTION harness.correction(p_person text, p_tid uuid, p_a text, p_b text, p_sa int, p_sb int) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE v_match uuid := harness.gm(p_tid, p_a, p_b); v_base text;
BEGIN
  PERFORM harness.claims(harness.p('olli'), false, 'authenticated');
  v_base := public.compute_match_state(v_match) ->> 'lastScoreEventId';
  PERFORM set_config('role', 'postgres', true);
  RETURN harness.events(p_person, v_match, jsonb_build_array(jsonb_build_object(
    'id', harness.u('corr:' || v_match || clock_timestamp()), 'type', 'CORRECTION', 'at', 2000,
    'section', NULL, 'clockMs', NULL, 'teamId', NULL, 'targetId', NULL,
    'payload', jsonb_build_object('scores', jsonb_build_object(harness.team(p_tid, p_a), p_sa, harness.team(p_tid, p_b), p_sb),
                                  'reason', 'Korrektur', 'basedOn', v_base))));
END;
$fn$;

-- Gleichstands-Entscheidung als JSON (wie StandingDecision; Grund nur, wenn angegeben)
CREATE FUNCTION harness.dec(p_id text, p_tid uuid, p_group text, p_kind text, p_names text, p_order text,
                            p_winner int DEFAULT NULL, p_loser int DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'groupId', p_group,
    'teamIds', to_jsonb(harness.ranking(p_tid, p_names)), 'order', to_jsonb(harness.ranking(p_tid, p_order)),
    'kind', p_kind,
    'shootout', CASE WHEN p_winner IS NOT NULL THEN jsonb_build_object('winner', p_winner, 'loser', p_loser) END,
    'basis', 'grundlage-' || p_id,
    'reason', p_reason))
$fn$;

CREATE FUNCTION harness.complete(p_person text, p_tid uuid, p_group text, p_ranking text, p_open integer[],
                                 p_decisions jsonb, p_known text[], p_expected jsonb, p_from_queue boolean)
RETURNS text LANGUAGE sql AS $fn$
  SELECT harness.rpc(harness.p(p_person), harness.pa(p_person), format(
    'SELECT public.complete_group(%L::uuid, %L, %L::uuid[], %L::integer[], %L::jsonb, %L::text[], %L::jsonb, %L::boolean)',
    p_tid, p_group, harness.ranking(p_tid, p_ranking), p_open, p_decisions, p_known, p_expected, p_from_queue))
$fn$;
CREATE FUNCTION harness.decide(p_person text, p_tid uuid, p_action text, p_decision jsonb, p_reason text, p_version integer)
RETURNS text LANGUAGE sql AS $fn$
  SELECT harness.rpc(harness.p(p_person), harness.pa(p_person), format(
    'SELECT public.record_standing_decision(%L::uuid, %L, %L::jsonb, %L, %L::integer)',
    p_tid, p_action, p_decision, p_reason, p_version))
$fn$;
CREATE FUNCTION harness.reopen(p_person text, p_tid uuid, p_group text, p_reason text, p_from_queue boolean DEFAULT false)
RETURNS text LANGUAGE sql AS $fn$
  SELECT harness.rpc(harness.p(p_person), harness.pa(p_person), format(
    'SELECT public.reopen_group(%L::uuid, %L, %L, %L::boolean)', p_tid, p_group, p_reason, p_from_queue))
$fn$;
CREATE FUNCTION harness.last() RETURNS jsonb LANGUAGE sql STABLE AS $fn$ SELECT res FROM harness.lastres WHERE k = 1 $fn$;


-- shared-allowed.json: eine Zeile als eigenes Turnier (IDs je Zeile umbenannt), dann match_engine.shared_allowed.
CREATE FUNCTION harness.shared_allowed_row(p_row jsonb, p_tag text) RETURNS boolean LANGUAGE plpgsql AS $fn$
DECLARE ids text[]; r jsonb; tid uuid := harness.u(p_tag); x jsonb; n int := 0;
BEGIN
  ids := ARRAY(SELECT t ->> 'id' FROM jsonb_array_elements(p_row -> 'teams') t)
      || ARRAY(SELECT m ->> 'id' FROM jsonb_array_elements(p_row -> 'matches') m);
  r := harness.remap(p_row, p_tag, ids);
  INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, version)
  VALUES (tid, harness.p('olli'), p_tag, '2026-11-28', jsonb_array_length(r -> 'teams'), 10, r -> 'config', 1);
  FOR x IN SELECT t FROM jsonb_array_elements(r -> 'teams') t LOOP
    INSERT INTO public.teams (id, tournament_id, name, group_letter)
    VALUES ((x ->> 'id')::uuid, tid, x ->> 'name', x ->> 'group');
  END LOOP;
  FOR x IN SELECT m FROM jsonb_array_elements(r -> 'matches') m LOOP
    n := n + 1;
    PERFORM harness.ins('matches', x || jsonb_build_object('tournament_id', tid, 'round', 10 + n, 'field', 1, 'phase', 'final'));
  END LOOP;
  RETURN match_engine.shared_allowed(tid, r ->> 'groupId',
           ARRAY(SELECT generate_series((r -> 'block' ->> 'place')::int,
                                        (r -> 'block' ->> 'place')::int + (r -> 'block' ->> 'size')::int - 1)),
           r -> 'config');
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
