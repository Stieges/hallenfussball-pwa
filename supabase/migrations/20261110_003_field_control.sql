-- supabase/migrations/20261110_003_field_control.sql
-- A-34 (MVP-Bauplan § 20, brief-A-34.md): Steuer je Feld am Server -- je Feld genau ein steuerndes Geraet mit Epoche,
-- Pruefung in append_match_events, "Spielleitung uebernehmen" als Server-Funktion
-- (@FU-026, @FU-027, @FU-028, @FU-030, @HE-049, @SL-015, @SL-046, @SL-116 Uebernahme-Teil; Zusammenspiel @FU-081, @SL-018;
-- Befund C-HELFER-FELD-OHNE-SPERRE, Server-Haelfte "fremd gesteuertes Feld").
--
-- Inhalt:
--   1. Tabelle public.field_control (tournament_id, field) -> epoch, holder_user_id, holder_device_id,
--      holder_device_label, claimed_at. Steuernd ist ein Geraet = Konto bzw. Geraetesitzung UND Geraete-ID.
--      epoch 0 = nie gesteuert; jeder Halterwechsel zaehlt +1. holder_user_id NULL = Feld frei.
--      RLS an, keine Policy, keine Tabellenrechte fuer anon/authenticated: nur die Definer-Funktionen lesen/schreiben.
--   2. public.field_control_info(...) (intern, ohne EXECUTE fuer Clients): Halter mit Name (wie
--      match_event_author_names: Eigentuemer -> display_name, Mitglied -> label, sonst display_name; nie E-Mail),
--      Rolle, Geraete-Bezeichnung, isMine, Epoche.
--   3. append_match_events (stapelt auf 20261028_003, Signatur unveraendert): Pruefung c3 je Ereignis -- an einem
--      laufenden Spiel (running, paused, section_break, decision_pending, shootout) und fuer MATCH_START/REOPEN nur das
--      steuernde Geraet; sonst rejected NOT_CONTROLLER mit detail {reason OTHER_DEVICE|STALE_EPOCH, Halter}. An nicht
--      laufenden Spielen sonst keine Steuer (Auflage Bauplan § 20: Direkteintrag, Korrektur, Absetzen, Nachtrag).
--      Freies Feld + Geraete-ID: der Aufrufer wird Halter (Epoche +1), sobald das Ereignis angenommen ist; die Zeile
--      des Feldes ist fuer den ganzen Aufruf gesperrt (genau ein Erst-Anspruch, @FU-030). Ohne Geraete-ID (App vor
--      B-49) entsteht kein Anspruch, ein bestehender gilt aber auch dann. controlEpoch null vom Halter zaehlt.
--      Antwort zusaetzlich `control` (Stand des Feldes aus Sicht dieses Geraets).
--   4. public.take_field_control(...): "Spielleitung uebernehmen" (online, nie im Ausgang) fuer jedes Geraet mit
--      writeMatchData; p_expected_epoch ist Pflicht (NULL -> 22023) und schuetzt vor veralteten Anfragen
--      (CONTROL_CHANGED, @FU-028).
--   5. public.field_control_state(...): Stand aller Felder eines Turniers (@HE-049 "Feld 2: Tom (Handy)").
--   6. Rechte: EXECUTE der zwei RPCs nur authenticated; append_match_events unveraendert.
--
-- Nicht geaendert: Signatur und Rechte von append_match_events, Rechenfunktion (match_engine.*, kein TS-Zwilling
-- noetig: die Pruefung ist reine Server-Pruefung wie die Serveruhr-Fristen c2), Policies anderer Tabellen,
-- Realtime-Publication (B-49 liest field_control_state). Keine Datenaenderung.
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, REVOKE/GRANT.
--
-- RUECKWEG: eigene Datei <Datum>_<NNN>_field_control_rollback.sql (Anhang B von A-34-sql-freigabe.md), in EINEM
-- Block. Vorher: App ohne B-49 (ruft die RPCs nicht). Inhalt: append_match_events woertlich aus
-- 20261028_003_result_entry_shootout.sql (Abschnitt 4 + Rechte Abschnitt 5), DROP FUNCTION field_control_state,
-- take_field_control, field_control_info, DROP TABLE field_control. Danach Assertions + PRIVILEGE_ASSERTION_NAMES
-- zurueck, Drift-Check, Typen-PR. Belegt in scripts/field-control-check.sh (Kategorie X).
--
-- Produktion: nur im DB-Fenster F3 (Di 10.11.) NACH 20261110_001 (A-11) und 20261110_002 (A-27) durch den Controller
-- nach Daniels Freigabe (A-34-sql-freigabe.md). Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast): A-27 (_002) eingespielt, Schreibweg in der Fassung 20261028_003
-- ============================================================================================
DO $$
BEGIN
  IF to_regprocedure('public.is_real_account()') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)') IS NULL
     OR to_regprocedure('match_engine.server_rules(integer,text,integer,integer,jsonb,jsonb,text)') IS NULL
     OR to_regclass('public.match_event_authors') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_collaborators_role_check'
                     AND pg_get_constraintdef(oid) LIKE '%''helper''%') THEN
    RAISE EXCEPTION '20261110_003_field_control: 20261110_002 (A-27) oder der Schreibweg 20261028_003 fehlen -- zuerst _001 und _002 einspielen';
  END IF;
END;
$$;

-- ============================================================================================
-- 1. Tabelle field_control: je Feld ein steuerndes Geraet mit Epoche
-- ============================================================================================
CREATE TABLE IF NOT EXISTS public.field_control (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  field integer NOT NULL,
  epoch integer NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  holder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  holder_device_id uuid,
  holder_device_label text CHECK (holder_device_label IS NULL OR char_length(holder_device_label) BETWEEN 1 AND 40),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, field)
);

COMMENT ON TABLE public.field_control IS
  'A-34 (Steuer je Feld, @FU-026/@FU-027/@FU-030): je Feld genau ein steuerndes Geraet (holder_user_id UND
   holder_device_id) mit Epoche (+1 je Halterwechsel, 0 = nie gesteuert). holder_user_id NULL = frei. Nur ueber
   append_match_events, take_field_control und field_control_state (SECURITY DEFINER) -- keine Client-Rechte.';

ALTER TABLE public.field_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.field_control FROM PUBLIC, anon, authenticated;

-- ============================================================================================
-- 2. field_control_info: Stand eines Feldes aus Sicht eines Geraets (intern)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.field_control_info(p_tournament_id uuid, p_field integer, p_device_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'field', fc.field,
           'epoch', fc.epoch,
           'holderName', CASE
             WHEN fc.holder_user_id IS NULL THEN NULL
             WHEN fc.holder_user_id = t.owner_id THEN nullif(btrim(p.display_name), '')
             ELSE coalesce(nullif(btrim(tc.label), ''), nullif(btrim(p.display_name), ''))
           END,
           'holderRole', CASE
             WHEN fc.holder_user_id IS NULL THEN NULL
             WHEN fc.holder_user_id = t.owner_id THEN 'owner'
             ELSE tc.role
           END,
           'holderDeviceLabel', CASE WHEN fc.holder_user_id IS NULL THEN NULL ELSE fc.holder_device_label END,
           'isMine', coalesce(fc.holder_user_id = auth.uid() AND fc.holder_device_id = p_device_id, false),
           'claimedAt', CASE WHEN fc.holder_user_id IS NULL THEN NULL
                             ELSE floor(extract(epoch FROM fc.claimed_at) * 1000)::bigint END)
    FROM public.field_control fc
    JOIN public.tournaments t ON t.id = fc.tournament_id
    LEFT JOIN public.profiles p ON p.id = fc.holder_user_id
    LEFT JOIN LATERAL (
      SELECT c.label, c.role
        FROM public.tournament_collaborators c
       WHERE c.tournament_id = t.id AND fc.holder_user_id IS NOT NULL AND c.user_id = fc.holder_user_id
       ORDER BY c.accepted_at DESC NULLS LAST, c.created_at DESC NULLS LAST
       LIMIT 1
    ) tc ON true
   WHERE fc.tournament_id = p_tournament_id
     AND fc.field = p_field;
$$;

REVOKE ALL ON FUNCTION public.field_control_info(uuid, integer, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ============================================================================================
-- 3. append_match_events: Pruefung c3 "Steuer je Feld" (Fassung 20261028_003 + A-34)
-- ============================================================================================

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
        IF v_state ->> 'status' = ANY (c_live_states) OR v_event ->> 'type' IN ('MATCH_START', 'REOPEN') THEN
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
            WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout')
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


-- ============================================================================================
-- 4. take_field_control: "Spielleitung uebernehmen" (@FU-027, @FU-028, @SL-015, @SL-116)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.take_field_control(p_tournament_id uuid, p_field integer, p_device_id uuid,
                                                     p_device_label text DEFAULT NULL,
                                                     p_expected_epoch integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_label text := nullif(btrim(p_device_label), '');
  v_fc public.field_control%ROWTYPE;
  v_previous jsonb;
  v_now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'take_field_control: nicht angemeldet (auth.uid() ist NULL)' USING ERRCODE = '42501';
  END IF;
  -- p_expected_epoch ist Pflicht: uebernommen wird nur mit bekanntem Stand (freies, nie gesteuertes Feld = 0);
  -- ein "unbedingt uebernehmen" gibt es nicht (A-34 Fixrunde 2, @FU-028).
  IF p_tournament_id IS NULL OR p_field IS NULL OR p_device_id IS NULL OR p_expected_epoch IS NULL THEN
    RAISE EXCEPTION 'take_field_control: Turnier, Feld, Geraete-ID und erwartete Epoche sind Pflicht' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_label) > 40 THEN
    RAISE EXCEPTION 'take_field_control: Geraete-Bezeichnung hoechstens 40 Zeichen' USING ERRCODE = '22023';
  END IF;

  -- Recht wie fuer Eintraege (Turnierleitung und Helfer, brief-A-34 L3). Papierkorb und unbekanntes Turnier
  -- antworten wie fehlendes Recht (kein Existenz-Orakel).
  IF NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL)
     OR NOT public.has_tournament_permission(p_tournament_id, 'writeMatchData') THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'FORBIDDEN_ACTOR', 'serverTime', v_now_ms);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.tournament_id = p_tournament_id AND m.field = p_field) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'UNKNOWN_FIELD', 'serverTime', v_now_ms);
  END IF;

  INSERT INTO public.field_control (tournament_id, field, epoch)
  VALUES (p_tournament_id, p_field, 0)
  ON CONFLICT (tournament_id, field) DO NOTHING;
  SELECT * INTO v_fc FROM public.field_control
   WHERE tournament_id = p_tournament_id AND field = p_field
     FOR UPDATE;

  -- Veraltete Anfrage (z. B. ohne Netz ausgeloest, spaeter gesendet; oder zwei Uebernahmen zugleich): nichts aendern.
  IF p_expected_epoch <> v_fc.epoch THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'CONTROL_CHANGED',
                              'control', public.field_control_info(p_tournament_id, p_field, p_device_id),
                              'serverTime', v_now_ms);
  END IF;

  -- Dasselbe Geraet steuert schon: Epoche bleibt, nur die Bezeichnung wird nachgetragen.
  IF v_fc.holder_user_id = v_uid AND v_fc.holder_device_id = p_device_id THEN
    IF v_label IS NOT NULL AND v_label IS DISTINCT FROM v_fc.holder_device_label THEN
      UPDATE public.field_control SET holder_device_label = v_label
       WHERE tournament_id = p_tournament_id AND field = p_field;
    END IF;
    RETURN jsonb_build_object('status', 'unchanged',
                              'control', public.field_control_info(p_tournament_id, p_field, p_device_id),
                              'serverTime', v_now_ms);
  END IF;

  v_previous := CASE WHEN v_fc.holder_user_id IS NULL THEN NULL
                     ELSE public.field_control_info(p_tournament_id, p_field, p_device_id) END;
  UPDATE public.field_control
     SET epoch = epoch + 1,
         holder_user_id = v_uid,
         holder_device_id = p_device_id,
         holder_device_label = v_label,
         claimed_at = clock_timestamp()
   WHERE tournament_id = p_tournament_id AND field = p_field;

  RETURN jsonb_build_object('status', 'taken',
                            'control', public.field_control_info(p_tournament_id, p_field, p_device_id),
                            'previous', v_previous,
                            'serverTime', v_now_ms);
END;
$$;

COMMENT ON FUNCTION public.take_field_control(uuid, integer, uuid, text, integer) IS
  'A-34 (@FU-027, @FU-028): Spielleitung uebernehmen -- das aufrufende Geraet (Konto/Geraetesitzung + Geraete-ID)
   steuert danach das Feld, Epoche +1. Nur online (nie im Ausgang); p_expected_epoch Pflicht (NULL -> 22023),
   <> aktuell -> CONTROL_CHANGED.
   Recht writeMatchData; sonst FORBIDDEN_ACTOR. Feld ohne Spiel -> UNKNOWN_FIELD.';

-- ============================================================================================
-- 5. field_control_state: Stand aller Felder eines Turniers (@HE-049, @FU-026, @FU-027)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.field_control_state(p_tournament_id uuid, p_device_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(public.field_control_info(fc.tournament_id, fc.field, p_device_id) ORDER BY fc.field),
                  '[]'::jsonb)
    FROM public.field_control fc
    JOIN public.tournaments t ON t.id = fc.tournament_id AND t.deleted_at IS NULL
   WHERE fc.tournament_id = p_tournament_id
     AND public.has_tournament_permission(p_tournament_id, 'writeMatchData');
$$;

COMMENT ON FUNCTION public.field_control_state(uuid, uuid) IS
  'A-34 (@HE-049): je Feld {field, epoch, holderName, holderRole, holderDeviceLabel, isMine, claimedAt}. Nur fuer
   Turnierleitung und Helfer (writeMatchData), sonst []. Name wie match_event_author_names, nie E-Mail.';

-- ============================================================================================
-- 6. Rechte
-- ============================================================================================
REVOKE ALL ON FUNCTION public.take_field_control(uuid, integer, uuid, text, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.take_field_control(uuid, integer, uuid, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.field_control_state(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.field_control_state(uuid, uuid) TO authenticated;
-- append_match_events: unveraendert wie 20261028_003 Abschnitt 5 (ausdruecklich wiederholt).
REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

COMMIT;
