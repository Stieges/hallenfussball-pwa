-- scripts/lib/tournament-lifecycle-harness.sql — Hilfen (Schema "lc") fuer scripts/tournament-lifecycle-check.sh (A-21a-S).
-- NUR im Wegwerf-Container; nie in eine echte Datenbank einspielen. Baut auf scripts/lib/group-completion-harness.sql auf
-- (Schema "harness": Identitaeten, echt erzeugte Turniere aus group-state.json, Ergebnisse ueber append_match_events).
-- Wird VOR 20261113_003 angelegt (Gegenprobe ohne Migration): Rumpf erst beim Aufruf pruefen.
SET check_function_bodies = off;
CREATE SCHEMA lc;
GRANT USAGE ON SCHEMA lc TO anon, authenticated, service_role;

-- Endstand aus Teamnamen und Platzziffern; Herkunft Gruppenplatz '' (Jeder gegen jeden) bzw. 'open' (Finalrunde).
CREATE FUNCTION lc.snap(p_tid uuid, p_names text, p_places integer[], p_origin text DEFAULT 'group',
                        p_scorers jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
LANGUAGE sql STABLE AS $fn$
  SELECT jsonb_build_object(
    'format', 1,
    'ranking', (SELECT jsonb_agg(jsonb_build_object(
                  'place', p_places[o], 'teamId', harness.team(p_tid, btrim(n)), 'teamName', btrim(n),
                  'origin', CASE WHEN p_origin = 'group' THEN jsonb_build_object('kind', 'groupPlace', 'group', '', 'place', p_places[o])
                                 ELSE jsonb_build_object('kind', 'open') END) ORDER BY o)
                  FROM unnest(string_to_array(p_names, ',')) WITH ORDINALITY AS x(n, o)),
    'scorers', p_scorers,
    'appVersion', '2.3.0',
    'computedAt', '2026-11-28T15:30:00.000Z')
$fn$;

-- Torschuetzenliste mit einem Spieler (Nummer 7 von DJK Kammer, 5 Tore) und einer Sammelzeile
CREATE FUNCTION lc.scorers(p_tid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT jsonb_build_array(
    jsonb_build_object('kind', 'player', 'rank', 1, 'teamId', harness.team(p_tid, 'DJK Kammer'), 'teamName', 'DJK Kammer',
                       'number', 7, 'goals', 5),
    jsonb_build_object('kind', 'noNumber', 'rank', NULL, 'teamId', harness.team(p_tid, 'TSV Petting'),
                       'teamName', 'TSV Petting', 'goals', 2))
$fn$;

-- Abschluss als Person; erwarteter Stand = aktueller Serverstand, falls nicht angegeben (als postgres gelesen).
CREATE FUNCTION lc.finish(p_person text, p_tid uuid, p_snap jsonb, p_rid uuid, p_expected jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_state jsonb := coalesce(p_expected, match_engine.tournament_state(p_tid));
BEGIN
  RETURN harness.rpc(harness.p(p_person), harness.pa(p_person), format(
    'SELECT public.finish_tournament(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)', p_tid, v_state, p_snap, p_rid));
END;
$fn$;

CREATE FUNCTION lc.reopen(p_person text, p_tid uuid, p_reason text, p_rid uuid) RETURNS text LANGUAGE sql AS $fn$
  SELECT harness.rpc(harness.p(p_person), harness.pa(p_person), format(
    'SELECT public.reopen_tournament(%L::uuid, %L, %L::uuid)', p_tid, p_reason, p_rid))
$fn$;

-- Abschluss-Liste als Person: Arten der offenen Punkte (Komma), danach '|' und Arten der Warnungen; Fehler: error:SQLSTATE
CREATE FUNCTION lc.preflight(p_person text, p_tid uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE s text; r jsonb;
BEGIN
  s := harness.rpc(harness.p(p_person), harness.pa(p_person), format('SELECT public.finish_preflight(%L::uuid)', p_tid));
  IF s <> 'ok' THEN
    RETURN s;
  END IF;
  r := harness.last();
  RETURN coalesce((SELECT string_agg(x ->> 'kind', ',' ORDER BY o) FROM jsonb_array_elements(r -> 'items') WITH ORDINALITY AS y(x, o)), '')
         || '|' || coalesce((SELECT string_agg(x ->> 'kind', ',' ORDER BY o) FROM jsonb_array_elements(r -> 'warnings') WITH ORDINALITY AS y(x, o)), '');
END;
$fn$;

CREATE FUNCTION lc.life(p_tid uuid) RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(public.tournament_lifecycle(p_tid), 'NULL')
$fn$;

-- Ereignis wie ein Geraet es sendet (Umschlag wie append-match-events-check.sh ev)
CREATE FUNCTION lc.ev(p_type text, p_key text, p_extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$
  SELECT jsonb_build_object('id', harness.u('lc-event:' || p_key), 'type', p_type, 'at', 1000, 'section', 1,
                            'clockMs', 0, 'teamId', NULL, 'targetId', NULL, 'payload', '{}'::jsonb) || p_extra
$fn$;

-- append_match_events als Person mit Geraete-ID; Ergebnis: status[:code] je Ereignis, Komma-getrennt; Fehler error:SQLSTATE
CREATE FUNCTION lc.append(p_person text, p_match uuid, p_events jsonb, p_device uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE v jsonb; s text;
BEGIN
  PERFORM harness.claims(harness.p(p_person), harness.pa(p_person), 'authenticated');
  BEGIN
    v := public.append_match_events(p_match, p_events, 1, p_device);
    s := coalesce((SELECT string_agg(x ->> 'status' || coalesce(':' || (x ->> 'code'), ''), ',' ORDER BY o)
                     FROM jsonb_array_elements(v -> 'results') WITH ORDINALITY AS y(x, o)), coalesce(v ->> 'error', 'leer'));
  EXCEPTION WHEN OTHERS THEN
    s := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN s;
END;
$fn$;

-- Ein gespeichertes Ereignis eines Spiels so, wie das Geraet es damals gesendet hat (fuer Wiederholungen)
CREATE FUNCTION lc.stored_event(p_match uuid) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT jsonb_build_object('id', e.id, 'type', e.type,
                            'at', floor(extract(epoch FROM e.client_time) * 1000)::bigint,
                            'section', e.section, 'clockMs', e.clock_ms, 'teamId', e.team_id, 'targetId', e.target_event_id,
                            'payload', e.payload)
    FROM public.match_events e WHERE e.match_id = p_match AND e.event_format IS NOT NULL ORDER BY e.seq LIMIT 1
$fn$;

-- Nikolaus abschliessbar machen: Gruppe '' mit „Ergebnis so akzeptieren“ fuer Petting/Otting abschliessen (R_NIKO).
CREATE FUNCTION lc.complete_niko(p_tid uuid) RETURNS text LANGUAGE sql AS $fn$
  SELECT harness.complete('olli', p_tid, '',
    'DJK Kammer,TSV Waging rot,TSV Petting,DJK Otting,TSV 1921 Fridolfing,TSV Waging blau', '{}',
    jsonb_build_array(harness.dec('annahme-' || p_tid, p_tid, '', 'shared', 'TSV Petting,DJK Otting', 'TSV Petting,DJK Otting')),
    '{}', match_engine.group_state(p_tid, ''), false)
$fn$;

-- Ergebnis eines Spiels direkt setzen (nur Vorbereitung als Superuser; ohne Engine-Eintraege)
CREATE FUNCTION lc.set_result(p_match uuid, p_a integer, p_b integer, p_pa integer DEFAULT NULL, p_pb integer DEFAULT NULL)
RETURNS void LANGUAGE sql AS $fn$
  UPDATE public.matches SET score_a = p_a, score_b = p_b, penalty_score_a = p_pa, penalty_score_b = p_pb,
         match_status = 'finished', decided_by = CASE WHEN p_pa IS NULL THEN 'regular' ELSE 'penalty' END
   WHERE id = p_match
$fn$;
CREATE FUNCTION lc.final(p_tid uuid, p_type text) RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT id FROM public.matches WHERE tournament_id = p_tid AND final_type = p_type
$fn$;
CREATE FUNCTION lc.semi(p_tid uuid, p_home text) RETURNS uuid LANGUAGE sql STABLE AS $fn$ SELECT harness.hf(p_tid, p_home) $fn$;

-- Zeilen eines Turniers als JSON (Eingabe fuer scripts/tournament-lifecycle-fixture.ts, wie die App sie liest)
CREATE FUNCTION lc.rows(p_tid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT jsonb_build_object(
    'tournament', (SELECT to_jsonb(t) FROM public.tournaments t WHERE t.id = p_tid),
    'teams', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]') FROM public.teams x WHERE x.tournament_id = p_tid),
    'matches', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.match_number, x.id), '[]') FROM public.matches x WHERE x.tournament_id = p_tid))
$fn$;

-- final-standings-roundrobin.json 'cases': Nikolaus (Fixture-IDs), Gruppe '' mit Reihenfolge und geteilten Bloecken des
-- Falls abgeschlossen, Teams ausserhalb der Reihenfolge entfernt (@ET-058). Ergebnis: Pruefung mit den Platzziffern des
-- Falls | Pruefung mit 1 … n ('ok' = stimmig, sonst Grund). Nur in einer Transaktion mit ROLLBACK aufrufen.
CREATE FUNCTION lc.snap_ids(p_tid uuid, p_ids uuid[], p_places integer[]) RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT jsonb_build_object('format', 1, 'scorers', '[]'::jsonb, 'appVersion', '2.3.0', 'computedAt', '2026-11-28T15:30:00.000Z',
    'ranking', (SELECT jsonb_agg(jsonb_build_object('place', p_places[o], 'teamId', x, 'teamName', harness.tname(x),
                                                    'origin', jsonb_build_object('kind', 'groupPlace', 'group', '', 'place', p_places[o]))
                                 ORDER BY o)
                  FROM unnest(p_ids) WITH ORDINALITY AS u(x, o)))
$fn$;
CREATE FUNCTION lc.rr_case(p_case jsonb) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  tid uuid := gen_random_uuid();
  v_order uuid[] := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p_case -> 'order') WITH ORDINALITY AS u(x, o) ORDER BY o);
  v_places integer[] := ARRAY(SELECT x::integer FROM jsonb_array_elements_text(p_case -> 'places') WITH ORDINALITY AS u(x, o) ORDER BY o);
  v_seq integer[] := ARRAY(SELECT generate_series(1, cardinality(v_order)));
BEGIN
  -- Eigenes Turnier „Jeder gegen jeden“ mit genau den Teams des Falls (IDs aus der Fixture) und einem entfernten Team
  -- (@ET-058: zaehlt nicht); ein Spiel 'all' genuegt fuer die Lesart „ohne Gruppen, ohne Finalrunde“.
  INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, status)
  VALUES (tid, harness.p('olli'), 'rr-' || tid, '2026-11-28', cardinality(v_order) + 1, 10, 'published');
  INSERT INTO public.teams (id, tournament_id, name)
  SELECT x, tid, 'Team ' || o FROM unnest(v_order) WITH ORDINALITY AS u(x, o);
  INSERT INTO public.teams (id, tournament_id, name, is_removed) VALUES (gen_random_uuid(), tid, 'Entfernt', true);
  INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, group_letter, match_status, score_a, score_b)
  VALUES (gen_random_uuid(), tid, 1, 1, v_order[1], v_order[2], 'all', 'finished', 1, 0);
  INSERT INTO public.group_completions (tournament_id, group_id, ranking, tie_orders, completed_by, based_on_state)
  VALUES (tid, '', v_order,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', 'shared', 'teamIds', b)), '[]'::jsonb)
             FROM jsonb_array_elements(p_case -> 'sharedBlocks') b),
          harness.p('olli'), '[]'::jsonb);
  RETURN coalesce(match_engine.final_standings_consistent(tid, lc.snap_ids(tid, v_order, v_places)), 'ok') || '|'
      || coalesce(match_engine.final_standings_consistent(tid, lc.snap_ids(tid, v_order, v_seq)), 'ok');
END;
$fn$;

-- tournament-state.json: Turnier der Fixture group-state.json (Fixture-IDs, mit/ohne Ergebnisse), dazu Zusatz-Updates je
-- Spiel ({id, set}); Ergebnis match_engine.tournament_state. Nur in einer Transaktion mit ROLLBACK aufrufen.
CREATE FUNCTION lc.state_case(p_case jsonb) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  tid uuid := harness.instantiate(p_case ->> 'tournament', NULL, coalesce((p_case ->> 'withResults')::boolean, false));
  u jsonb;
  cols text;
BEGIN
  FOR u IN SELECT x FROM jsonb_array_elements(coalesce(p_case -> 'extraUpdates', '[]'::jsonb)) x LOOP
    SELECT string_agg(quote_ident(k), ', ') INTO cols FROM jsonb_object_keys(u -> 'set') k;
    EXECUTE format('UPDATE public.matches SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.matches, $1)) WHERE id = $2',
                   cols, cols) USING u -> 'set', (u ->> 'id')::uuid;
  END LOOP;
  RETURN match_engine.tournament_state(tid);
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lc TO anon, authenticated, service_role;
