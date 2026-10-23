-- supabase/migrations/20261110_010_standing_decision_null_version.sql
-- Fehlerbehebung zu 20261110_006_group_completion (record_standing_decision), Cloud-E2E N6d (@ET-055, @W2A-067).
--
-- Befund: record_standing_decision prueft die Turnierversion mit `v_t.version IS DISTINCT FROM p_expected_version`.
-- tournaments.version darf NULL sein (Spalte ohne NOT NULL; der Seed des Durchstichs legt Turniere so an). Die App
-- schickt dann 0 (`tournament.version ?? 0`), NULL IS DISTINCT FROM 0 ist wahr -> jede Entscheidung wird als STALE
-- abgelehnt, auch der zweite Versuch nach frischem Lesen. Der fruehere REST-Schreibweg (standingDecisionsCloud.ts) und
-- das Schreiben in derselben Funktion (`coalesce(version, 0) + 1`) behandeln NULL als 0 -- nur die Pruefung nicht.
--
-- Aenderung: nur diese Pruefung (und die gemeldete Version) behandelt NULL als 0. Signatur, Rechte, Sperren,
-- Rueckgabeformen und alle uebrigen Zweige sind unveraendert (CREATE OR REPLACE behaelt EXECUTE-Rechte und Eigentuemer).
-- complete_group/reopen_group pruefen keine Turnierversion und bleiben unberuehrt.
--
-- Produktion (gelesen 23.10.): 0 Turniere mit version IS NULL -- dort wirkt der Fehler heute nicht; die Migration
-- schliesst die Luecke fuer jede kuenftige Zeile ohne Version.
--
-- RUECKWEG: die Funktion in der Fassung aus 20261110_006_group_completion.sql (Abschnitt 4) erneut einspielen.

DO $$
BEGIN
  IF to_regprocedure('public.record_standing_decision(uuid,text,jsonb,text,integer)') IS NULL THEN
    RAISE EXCEPTION '20261110_010_standing_decision_null_version: Voraussetzung fehlt – zuerst 20261110_006 einspielen';
  END IF;
END;
$$;

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
      RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_APPLIED', 'version', coalesce(v_t.version, 0));
    END IF;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'DUPLICATE_ID');
  END IF;
  IF p_action = 'withdraw' AND v_old IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.bracket_log l
                WHERE l.tournament_id = p_tournament_id AND l.kind = 'standing_withdraw'
                  AND l.detail ->> 'id' = p_decision ->> 'id') THEN
      RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_APPLIED', 'version', coalesce(v_t.version, 0));
    END IF;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_FOUND');
  END IF;

  -- 20261110_010: eine Zeile ohne Version (version IS NULL) gilt als Version 0 – wie beim Schreiben unten und im
  -- frueheren REST-Schreibweg (standingDecisionsCloud.ts); vorher lehnte die Pruefung sie IMMER als STALE ab.
  IF coalesce(v_t.version, 0) IS DISTINCT FROM p_expected_version THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'STALE', 'version', coalesce(v_t.version, 0));
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

