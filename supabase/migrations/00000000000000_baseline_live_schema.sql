-- =============================================================================
-- BASELINE-MIGRATION: Schema-Fundament der Supabase-Produktionsdatenbank
-- =============================================================================
--
-- Wozu diese Datei da ist:
--   Von den 13 Tabellen des `public`-Schemas hatte bisher genau EINE ein
--   `CREATE TABLE` im Repository. Die 23 vorher vorhandenen Migrationsdateien
--   sind ausnahmslos `ALTER`, Policies und Funktionen auf einem Fundament,
--   das nirgends im Repo stand. Diese Datei legt dieses Fundament nachträglich
--   an, indem sie den tatsächlichen Live-Zustand des `public`-Schemas als
--   erste Migration erfasst. Die vierzehnstellige Null im Dateinamen
--   (`00000000000000_...`) sortiert vor jeder Bestandsmigration, sodass diese
--   Baseline beim Wiederaufbau der Datenbank zuerst läuft.
--
-- Wann erzeugt:
--   2026-09-21
--
-- Aus welchem Projekt:
--   Supabase-Projekt `amtlqicosscsjnnthvzm` ("Stieges's Project",
--   Central EU / Frankfurt).
--
-- Mit welchem Befehl erzeugt:
--   supabase db dump --schema public --linked
--   (kein Datenbank-Passwort nötig, kein lokales pg_dump — die Supabase-CLI
--   nutzt intern einen Docker-Container in exakt der Live-Postgres-Version.
--   Siehe .superpowers/sdd/2026-09-21-db-baseline-und-testmuell/task-1-report.md
--   für die vollständige Herleitung dieses Befehls.)
--
-- Was aus dem rohen Dump entfernt wurde (Rohdump: 2270 Zeilen):
--   1. `ALTER ... OWNER TO ...`-Zeilen (42 Stück). Die Zielrollen sind
--      ausschließlich "postgres" und "pg_database_owner" — Supabase-
--      Plattformrollen, keine portable Aussage über das Anwendungsschema.
--      Jede neu angelegte Supabase-Instanz vergibt diese Owner automatisch.
--   2. `GRANT`-Zeilen (127 Stück, beginnend mit dem Token GRANT) sowie
--      1 `REVOKE`-Zeile — Rechtezuweisungen an "anon", "authenticated",
--      "service_role" und "postgres". Boilerplate, das jedes Supabase-Projekt
--      bei der Provisionierung selbst mitbringt.
--   3. Zusätzlich (über den Auftrag hinaus, aber derselben Kategorie
--      zugehörig): 12 `ALTER DEFAULT PRIVILEGES ... GRANT ...`-Zeilen, die
--      Standard-Rechte für künftige Objekte an dieselben vier Plattform-
--      rollen vergeben. Diese Zeilen beginnen nicht mit dem Token GRANT,
--      sind inhaltlich aber Rechtezuweisungen an dieselben Rollen und wurden
--      deshalb aus Konsistenz mit Punkt 2 ebenfalls entfernt. Siehe Report
--      (task-4-report.md) für die Begründung im Detail.
--   Alles außerhalb von `public` war durch `--schema public` bereits
--   ausgeschlossen (0 Treffer für auth/storage/realtime/extensions/vault/
--   cron-Objekte im Rohdump).
--
-- Was bewusst NICHT entfernt wurde:
--   9 Fremdschlüssel-Constraints mit `REFERENCES "auth"."users"("id")`
--   sowie 64 Aufrufe von "auth"."uid"() und 3 Aufrufe von "auth"."email"()
--   in RLS-Policies (insgesamt 76 Referenzen auf das `auth`-Schema). Diese
--   MÜSSEN bleiben, sonst bricht das Schema. Sie bedeuten zugleich: diese
--   Baseline ist nur auf einer Supabase-Instanz anwendbar (die `auth.users`
--   automatisch provisioniert), nicht auf einem nackten Postgres.
--   Hinweis zum Auftrag: Der Task-Auftrag nannte als Erwartungswert
--   "63 Fremdschlüsselreferenzen auf auth.users" — der Rohdump enthält
--   tatsächlich nur 9 solcher Fremdschlüssel-Constraints. 63/64 ist vermutlich
--   mit der Zahl der auth.uid()-Aufrufe verwechselt worden. Siehe Report für
--   den vollständigen Befund.
--
-- Zeitlicher Stand:
--   Diese Datei bildet den Zustand NACH den Migrationen vom 18.09.2026
--   (20260918_001 bis 20260918_003) und vom 21.09.2026 (20260921_001) ab.
--   Sie ist eine reine Ist-Zustands-Momentaufnahme zum Erzeugungszeitpunkt,
--   keine rekonstruierte Historie.
--
-- =============================================================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


COMMENT ON SCHEMA "public" IS 'standard public schema';


CREATE OR REPLACE FUNCTION "public"."anonymous_tournament_limit"() RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN 3;
END;
$$;


COMMENT ON FUNCTION "public"."anonymous_tournament_limit"() IS 'Returns the maximum number of active tournaments for anonymous users';


CREATE OR REPLACE FUNCTION "public"."can_create_tournament"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  current_count INTEGER;
  max_limit INTEGER;
  is_anon BOOLEAN;
BEGIN
  is_anon := is_anonymous_user();
  current_count := count_active_tournaments(auth.uid());
  max_limit := CASE WHEN is_anon THEN anonymous_tournament_limit() ELSE 999999 END;
  RETURN jsonb_build_object(
    'canCreate', current_count < max_limit,
    'isAnonymous', is_anon,
    'currentCount', current_count,
    'limit', max_limit,
    'remaining', GREATEST(0, max_limit - current_count)
  );
END;
$$;


COMMENT ON FUNCTION "public"."can_create_tournament"() IS 'Returns whether the current user can create a new tournament and their limits';


CREATE OR REPLACE FUNCTION "public"."cascade_tournament_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
    UPDATE teams SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE matches SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE sponsors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE monitors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;

    UPDATE match_events SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);

    UPDATE match_corrections SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."count_active_tournaments"("user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count FROM tournaments
  WHERE owner_id = user_id AND (status IS NULL OR status NOT IN ('archived', 'deleted'));
  RETURN COALESCE(active_count, 0);
END;
$$;


COMMENT ON FUNCTION "public"."count_active_tournaments"("user_id" "uuid") IS 'Counts active (non-archived) tournaments for a user';


CREATE OR REPLACE FUNCTION "public"."enforce_release_before_public"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Nur beim UEBERGANG nach oeffentlich pruefen, nicht bei jedem Update einer bereits
  -- oeffentlichen Zeile — sonst waere eine Altzeile ohne publishedAt dauerhaft unveraenderbar.
  IF NEW.is_public IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.is_public IS DISTINCT FROM TRUE)
     AND NOT (COALESCE(NEW.config, '{}'::jsonb) ? 'publishedAt')
  THEN
    RAISE EXCEPTION 'Tournament has not been released yet and cannot be made public'
      USING ERRCODE = 'HF001';
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."generate_share_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    auth_provider = COALESCE(public.profiles.auth_provider, EXCLUDED.auth_provider),
    updated_at = now();
  
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."increment_match_event_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."increment_monitor_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."increment_sponsor_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."increment_team_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."is_anonymous_user"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN COALESCE((auth.jwt() -> 'is_anonymous')::text::boolean, false);
END;
$$;


COMMENT ON FUNCTION "public"."is_anonymous_user"() IS 'Returns true if the current user is an anonymous sign-in';


CREATE OR REPLACE FUNCTION "public"."is_tournament_admin"("p_tournament_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_collaborators
    WHERE tournament_id = p_tournament_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  );
$$;


CREATE OR REPLACE FUNCTION "public"."is_tournament_collaborator"("p_tournament_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_collaborators
    WHERE tournament_id = p_tournament_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;


CREATE OR REPLACE FUNCTION "public"."is_tournament_owner"("p_tournament_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  );
$$;


CREATE OR REPLACE FUNCTION "public"."make_tournament_private"("tournament_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  UPDATE tournaments
  SET
    is_public = false,
    share_code = NULL,
    share_code_created_at = NULL
  WHERE id = tournament_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."make_tournament_public"("tournament_id" "uuid") RETURNS TABLE("share_code" "text", "share_code_created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- Freigabe-Backstop: ohne publishedAt im config-JSONB ist das Turnier ein Entwurf.
  -- NICHT 'PT001' (und kein anderer Code aus der PT-Namespace): PostgREST interpretiert
  -- SQLSTATEs der Form PTxyz als HTTP-Status-Override, 'PT001' waere HTTP-Status 1 —
  -- keine gueltige Status-Zeile, die Response kaeme beim Client gar nicht intakt an.
  -- 'HF' ist weder von Postgres reserviert noch Teil der PT-Namespace.
  IF NOT (
    COALESCE(
      (SELECT config FROM tournaments WHERE id = tournament_id),
      '{}'::jsonb
    ) ? 'publishedAt'
  ) THEN
    RAISE EXCEPTION 'Tournament has not been released yet and cannot be made public'
      USING ERRCODE = 'HF001';
  END IF;

  -- Generate unique code with retry logic
  LOOP
    attempt := attempt + 1;
    new_code := generate_share_code();

    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM tournaments WHERE tournaments.share_code = new_code) THEN
      EXIT;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Update tournament
  UPDATE tournaments
  SET
    is_public = true,
    share_code = new_code,
    share_code_created_at = NOW()
  WHERE id = tournament_id;

  RETURN QUERY SELECT new_code, NOW();
END;
$$;


CREATE OR REPLACE FUNCTION "public"."merge_user_data"("p_source_user_id" "uuid", "p_target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tournaments_count INTEGER := 0;
  v_teams_count INTEGER := 0;
  v_matches_count INTEGER := 0;
  v_events_count INTEGER := 0;
  v_members_count INTEGER := 0;
  v_tournament_ids UUID[];
BEGIN
  IF p_source_user_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Both source and target user IDs are required';
  END IF;

  IF p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Source and target user IDs cannot be the same';
  END IF;

  SELECT ARRAY_AGG(id) INTO v_tournament_ids FROM tournaments WHERE owner_id = p_source_user_id;

  WITH updated AS (
    UPDATE tournaments SET owner_id = p_target_user_id WHERE owner_id = p_source_user_id RETURNING id
  )
  SELECT COUNT(*) INTO v_tournaments_count FROM updated;

  IF v_tournament_ids IS NOT NULL AND array_length(v_tournament_ids, 1) > 0 THEN
    WITH updated AS (
      UPDATE teams SET owner_id = p_target_user_id
      WHERE owner_id = p_source_user_id OR tournament_id = ANY(v_tournament_ids)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_teams_count FROM updated;

    WITH updated AS (
      UPDATE matches SET owner_id = p_target_user_id
      WHERE owner_id = p_source_user_id OR tournament_id = ANY(v_tournament_ids)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_matches_count FROM updated;

    WITH updated AS (
      UPDATE match_events SET owner_id = p_target_user_id WHERE owner_id = p_source_user_id RETURNING id
    )
    SELECT COUNT(*) INTO v_events_count FROM updated;

    WITH updated AS (
      UPDATE tournament_members SET user_id = p_target_user_id
      WHERE user_id = p_source_user_id AND tournament_id = ANY(v_tournament_ids)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_members_count FROM updated;
  END IF;

  DELETE FROM profiles WHERE id = p_source_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'source_user_id', p_source_user_id,
    'target_user_id', p_target_user_id,
    'transferred', jsonb_build_object(
      'tournaments', v_tournaments_count,
      'teams', v_teams_count,
      'matches', v_matches_count,
      'match_events', v_events_count,
      'tournament_members', v_members_count
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Merge failed: %', SQLERRM;
END;
$$;


COMMENT ON FUNCTION "public"."merge_user_data"("p_source_user_id" "uuid", "p_target_user_id" "uuid") IS 'Atomically merges all data from an anonymous user to a target authenticated user.
Used by the merge-accounts Edge Function for account consolidation.
Runs in a single transaction - any failure triggers full rollback.';


CREATE OR REPLACE FUNCTION "public"."record_monitor_heartbeat"("p_monitor_id" "uuid", "p_tournament_id" "uuid", "p_slide_index" integer DEFAULT NULL::integer, "p_cache_status" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM monitors m
    WHERE m.id = p_monitor_id
      AND m.tournament_id = p_tournament_id
      AND (m.is_public = true OR m.owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'monitor/tournament mismatch or not visible' USING ERRCODE = '42501';
  END IF;

  INSERT INTO monitor_heartbeats
    (monitor_id, tournament_id, last_seen, slide_index, cache_status, user_agent)
  VALUES
    (p_monitor_id, p_tournament_id, now(), p_slide_index, p_cache_status, p_user_agent)
  ON CONFLICT (monitor_id) DO UPDATE SET
    tournament_id = EXCLUDED.tournament_id,
    last_seen     = now(),
    slide_index   = EXCLUDED.slide_index,
    cache_status  = EXCLUDED.cache_status,
    user_agent    = EXCLUDED.user_agent;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."regenerate_share_code"("tournament_id" "uuid") RETURNS TABLE("share_code" "text", "share_code_created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- Generate unique code with retry logic
  LOOP
    attempt := attempt + 1;
    new_code := generate_share_code();

    IF NOT EXISTS (SELECT 1 FROM tournaments WHERE tournaments.share_code = new_code) THEN
      EXIT;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Update tournament
  UPDATE tournaments
  SET
    share_code = new_code,
    share_code_created_at = NOW()
  WHERE id = tournament_id;

  RETURN QUERY SELECT new_code, NOW();
END;
$$;


CREATE OR REPLACE FUNCTION "public"."revert_stats_on_event_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_match RECORD;
BEGIN
  IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    
    SELECT team_a_id, team_b_id INTO v_match
    FROM matches WHERE id = NEW.match_id;
    
    IF NEW.type = 'GOAL' THEN
      IF NEW.team_id = v_match.team_a_id THEN
        UPDATE matches 
        SET score_a = GREATEST(score_a - 1, 0),
            version = version + 1,
            updated_at = NOW()
        WHERE id = NEW.match_id;
      ELSIF NEW.team_id = v_match.team_b_id THEN
        UPDATE matches 
        SET score_b = GREATEST(score_b - 1, 0),
            version = version + 1,
            updated_at = NOW()
        WHERE id = NEW.match_id;
      END IF;
      
      IF NEW.player_id IS NOT NULL THEN
        UPDATE team_players 
        SET goals = GREATEST(goals - 1, 0), updated_at = NOW()
        WHERE id = NEW.player_id;
      END IF;
      
    ELSIF NEW.type = 'OWN_GOAL' THEN
      IF NEW.team_id = v_match.team_a_id THEN
        UPDATE matches 
        SET score_b = GREATEST(score_b - 1, 0),
            version = version + 1,
            updated_at = NOW()
        WHERE id = NEW.match_id;
      ELSIF NEW.team_id = v_match.team_b_id THEN
        UPDATE matches 
        SET score_a = GREATEST(score_a - 1, 0),
            version = version + 1,
            updated_at = NOW()
        WHERE id = NEW.match_id;
      END IF;
      
    ELSIF NEW.type = 'YELLOW_CARD' AND NEW.player_id IS NOT NULL THEN
      UPDATE team_players 
      SET yellow_cards = GREATEST(yellow_cards - 1, 0), updated_at = NOW()
      WHERE id = NEW.player_id;
      
    ELSIF NEW.type = 'YELLOW_RED_CARD' AND NEW.player_id IS NOT NULL THEN
      UPDATE team_players 
      SET yellow_cards = GREATEST(yellow_cards - 1, 0),
          red_cards = GREATEST(red_cards - 1, 0),
          updated_at = NOW()
      WHERE id = NEW.player_id;
      
    ELSIF NEW.type = 'RED_CARD' AND NEW.player_id IS NOT NULL THEN
      UPDATE team_players 
      SET red_cards = GREATEST(red_cards - 1, 0), updated_at = NOW()
      WHERE id = NEW.player_id;
      
    ELSIF NEW.type = 'TIME_PENALTY' AND NEW.player_id IS NOT NULL THEN
      UPDATE team_players 
      SET time_penalties_count = GREATEST(time_penalties_count - 1, 0),
          time_penalties_minutes = GREATEST(time_penalties_minutes - COALESCE((NEW.payload->>'duration')::INTEGER / 60, 2), 0),
          updated_at = NOW()
      WHERE id = NEW.player_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."sync_match_score_from_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_match RECORD;
BEGIN
  IF NEW.type NOT IN ('GOAL', 'OWN_GOAL') THEN
    RETURN NEW;
  END IF;
  
  SELECT team_a_id, team_b_id INTO v_match
  FROM matches WHERE id = NEW.match_id;
  
  IF NEW.type = 'GOAL' THEN
    IF NEW.team_id = v_match.team_a_id THEN
      UPDATE matches 
      SET score_a = COALESCE(score_a, 0) + 1, 
          version = version + 1,
          updated_at = NOW()
      WHERE id = NEW.match_id;
    ELSIF NEW.team_id = v_match.team_b_id THEN
      UPDATE matches 
      SET score_b = COALESCE(score_b, 0) + 1,
          version = version + 1,
          updated_at = NOW()
      WHERE id = NEW.match_id;
    END IF;
  ELSIF NEW.type = 'OWN_GOAL' THEN
    IF NEW.team_id = v_match.team_a_id THEN
      UPDATE matches 
      SET score_b = COALESCE(score_b, 0) + 1,
          version = version + 1,
          updated_at = NOW()
      WHERE id = NEW.match_id;
    ELSIF NEW.team_id = v_match.team_b_id THEN
      UPDATE matches 
      SET score_a = COALESCE(score_a, 0) + 1,
          version = version + 1,
          updated_at = NOW()
      WHERE id = NEW.match_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."sync_owner_from_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  SELECT owner_id, is_public
  INTO NEW.owner_id, NEW.is_public
  FROM matches
  WHERE id = NEW.match_id;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."sync_owner_from_tournament"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  SELECT owner_id, is_public
  INTO NEW.owner_id, NEW.is_public
  FROM tournaments
  WHERE id = NEW.tournament_id;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."tournament_limit_error_message"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF is_anonymous_user() THEN
    RETURN 'Du hast das Limit von 3 Turnieren erreicht. Registriere dich kostenlos, um unbegrenzt Turniere zu erstellen.';
  ELSE
    RETURN NULL;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."update_player_stats_from_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  CASE NEW.type
    WHEN 'GOAL' THEN
      UPDATE team_players 
      SET goals = goals + 1, updated_at = NOW()
      WHERE id = NEW.player_id;
      
    WHEN 'YELLOW_CARD' THEN
      UPDATE team_players 
      SET yellow_cards = yellow_cards + 1, updated_at = NOW()
      WHERE id = NEW.player_id;
      
    WHEN 'YELLOW_RED_CARD' THEN
      UPDATE team_players 
      SET yellow_cards = yellow_cards + 1,
          red_cards = red_cards + 1,
          updated_at = NOW()
      WHERE id = NEW.player_id;
      
    WHEN 'RED_CARD' THEN
      UPDATE team_players 
      SET red_cards = red_cards + 1, updated_at = NOW()
      WHERE id = NEW.player_id;
      
    WHEN 'TIME_PENALTY' THEN
      UPDATE team_players 
      SET time_penalties_count = time_penalties_count + 1,
          time_penalties_minutes = time_penalties_minutes + COALESCE((NEW.payload->>'duration')::INTEGER / 60, 2),
          updated_at = NOW()
      WHERE id = NEW.player_id;
      
    ELSE
      NULL;
  END CASE;
  
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."user_owns_tournament"("p_tournament_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  -- Direct table access bypasses RLS (SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."match_corrections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "previous_score_a" integer NOT NULL,
    "previous_score_b" integer NOT NULL,
    "new_score_a" integer NOT NULL,
    "new_score_b" integer NOT NULL,
    "reason_type" "text",
    "note" "text",
    "corrected_by" "uuid",
    "corrected_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid",
    "is_public" boolean DEFAULT false,
    CONSTRAINT "match_corrections_reason_type_check" CHECK (("reason_type" = ANY (ARRAY['input_error'::"text", 'referee_decision'::"text", 'protest_accepted'::"text", 'technical_error'::"text", 'other'::"text"])))
);


COMMENT ON COLUMN "public"."match_corrections"."owner_id" IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';


COMMENT ON COLUMN "public"."match_corrections"."is_public" IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';


CREATE TABLE IF NOT EXISTS "public"."match_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "player_id" "uuid",
    "team_id" "uuid",
    "timestamp_seconds" numeric(10,1) NOT NULL,
    "period" "text" DEFAULT 'regular'::"text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "score_home" integer NOT NULL,
    "score_away" integer NOT NULL,
    "incomplete" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1 NOT NULL,
    "owner_id" "uuid",
    "is_public" boolean DEFAULT false,
    CONSTRAINT "match_events_period_check" CHECK (("period" = ANY (ARRAY['regular'::"text", 'overtime'::"text", 'penalty'::"text"]))),
    CONSTRAINT "match_events_type_check" CHECK (("type" = ANY (ARRAY['GOAL'::"text", 'OWN_GOAL'::"text", 'YELLOW_CARD'::"text", 'YELLOW_RED_CARD'::"text", 'RED_CARD'::"text", 'TIME_PENALTY'::"text", 'TIME_PENALTY_END'::"text", 'SUBSTITUTION'::"text", 'TIMEOUT'::"text", 'STATUS_CHANGE'::"text", 'RESULT_EDIT'::"text", 'NOTE'::"text", 'FOUL'::"text", 'HALFTIME'::"text"])))
);


COMMENT ON COLUMN "public"."match_events"."version" IS 'Optimistic locking version. Auto-incremented on each UPDATE.';


COMMENT ON COLUMN "public"."match_events"."owner_id" IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';


COMMENT ON COLUMN "public"."match_events"."is_public" IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "match_number" integer,
    "round" integer NOT NULL,
    "field" integer NOT NULL,
    "slot" integer,
    "phase" "text" DEFAULT 'groupStage'::"text",
    "group_letter" "text",
    "team_a_id" "uuid",
    "team_b_id" "uuid",
    "team_a_placeholder" "text",
    "team_b_placeholder" "text",
    "score_a" integer DEFAULT 0,
    "score_b" integer DEFAULT 0,
    "overtime_score_a" integer,
    "overtime_score_b" integer,
    "penalty_score_a" integer,
    "penalty_score_b" integer,
    "decided_by" "text",
    "is_final" boolean DEFAULT false,
    "final_type" "text",
    "label" "text",
    "match_status" "text" DEFAULT 'scheduled'::"text",
    "scheduled_start" time without time zone,
    "actual_start" timestamp with time zone,
    "actual_end" timestamp with time zone,
    "duration_minutes" integer,
    "skipped_at" timestamp with time zone,
    "skipped_reason" "text",
    "timer_start_time" timestamp with time zone,
    "timer_paused_at" timestamp with time zone,
    "timer_elapsed_seconds" integer DEFAULT 0,
    "referee_number" integer,
    "referee_team_id" "uuid",
    "version" integer DEFAULT 1,
    "last_modified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "live_state" "jsonb",
    "owner_id" "uuid",
    "is_public" boolean DEFAULT false,
    CONSTRAINT "matches_decided_by_check" CHECK (("decided_by" = ANY (ARRAY['regular'::"text", 'overtime'::"text", 'goldenGoal'::"text", 'penalty'::"text"]))),
    CONSTRAINT "matches_final_type_check" CHECK (("final_type" = ANY (ARRAY['quarterfinal'::"text", 'semifinal'::"text", 'thirdPlace'::"text", 'final'::"text"]))),
    CONSTRAINT "matches_match_status_check" CHECK (("match_status" = ANY (ARRAY['scheduled'::"text", 'waiting'::"text", 'running'::"text", 'paused'::"text", 'finished'::"text", 'skipped'::"text"]))),
    CONSTRAINT "matches_phase_check" CHECK (("phase" = ANY (ARRAY['groupStage'::"text", 'quarterfinal'::"text", 'semifinal'::"text", 'thirdPlace'::"text", 'final'::"text"])))
);


COMMENT ON COLUMN "public"."matches"."live_state" IS 'Transient live match state (playPhase, tiebreaker info, etc.). Null when match is not live.';


COMMENT ON COLUMN "public"."matches"."owner_id" IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';


COMMENT ON COLUMN "public"."matches"."is_public" IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';


CREATE TABLE IF NOT EXISTS "public"."monitor_heartbeats" (
    "monitor_id" "uuid" NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slide_index" integer,
    "cache_status" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "monitor_heartbeats_cache_status_check" CHECK (("cache_status" = ANY (ARRAY['fresh'::"text", 'stale'::"text", 'critical'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."monitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'schedule'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "access_code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1 NOT NULL,
    "owner_id" "uuid",
    "is_public" boolean DEFAULT false,
    CONSTRAINT "monitors_type_check" CHECK (("type" = ANY (ARRAY['schedule'::"text", 'scoreboard'::"text", 'standings'::"text", 'groups'::"text", 'custom'::"text", 'slideshow'::"text"])))
);


COMMENT ON COLUMN "public"."monitors"."version" IS 'Optimistic locking version. Auto-incremented on each UPDATE.';


COMMENT ON COLUMN "public"."monitors"."owner_id" IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';


COMMENT ON COLUMN "public"."monitors"."is_public" IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "email" "text",
    "avatar_url" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "auth_provider" "text" DEFAULT 'email'::"text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


COMMENT ON COLUMN "public"."profiles"."auth_provider" IS 'Auth provider used for registration. Values: email, google, github, apple. Used for ghost password prevention.';


CREATE TABLE IF NOT EXISTS "public"."sponsors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "logo_path" "text",
    "website_url" "text",
    "tier" "text" DEFAULT 'bronze'::"text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "show_on_schedule" boolean DEFAULT true,
    "show_on_monitor" boolean DEFAULT true,
    "show_on_pdf" boolean DEFAULT false,
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1 NOT NULL,
    "owner_id" "uuid",
    "is_public" boolean DEFAULT false,
    CONSTRAINT "sponsors_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


COMMENT ON COLUMN "public"."sponsors"."version" IS 'Optimistic locking version. Auto-incremented on each UPDATE.';


COMMENT ON COLUMN "public"."sponsors"."owner_id" IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';


COMMENT ON COLUMN "public"."sponsors"."is_public" IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';


CREATE TABLE IF NOT EXISTS "public"."sync_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "changed_fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "base_data" "jsonb",
    "base_version" integer,
    "local_timestamp" timestamp with time zone NOT NULL,
    "server_timestamp" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "conflict_data" "jsonb",
    "conflicting_fields" "text"[],
    "conflict_resolution" "text",
    "resolved_at" timestamp with time zone,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "sync_queue_conflict_resolution_check" CHECK (("conflict_resolution" = ANY (ARRAY['local'::"text", 'server'::"text", 'merged'::"text"]))),
    CONSTRAINT "sync_queue_operation_check" CHECK (("operation" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"]))),
    CONSTRAINT "sync_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'syncing'::"text", 'synced'::"text", 'conflict'::"text", 'failed'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."team_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "number" integer NOT NULL,
    "name" "text",
    "position" "text",
    "is_captain" boolean DEFAULT false,
    "goals" integer DEFAULT 0,
    "assists" integer DEFAULT 0,
    "yellow_cards" integer DEFAULT 0,
    "red_cards" integer DEFAULT 0,
    "time_penalties_count" integer DEFAULT 0,
    "time_penalties_minutes" integer DEFAULT 0,
    "matches_played" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_players_position_check" CHECK (("position" = ANY (ARRAY['GK'::"text", 'DEF'::"text", 'MID'::"text", 'FWD'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "group_letter" "text",
    "sort_order" integer DEFAULT 0,
    "is_removed" boolean DEFAULT false,
    "removed_at" timestamp with time zone,
    "removed_reason" "text",
    "logo_path" "text",
    "logo_background_color" "text",
    "color_primary" "text",
    "color_secondary" "text",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid",
    "is_public" boolean DEFAULT false
);


COMMENT ON COLUMN "public"."teams"."version" IS 'Optimistic locking version. Auto-incremented on each UPDATE.';


COMMENT ON COLUMN "public"."teams"."owner_id" IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';


COMMENT ON COLUMN "public"."teams"."is_public" IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';


CREATE TABLE IF NOT EXISTS "public"."tournament_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "invite_email" "text",
    "invite_code" "text",
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "allowed_fields" integer[],
    "allowed_groups" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "label" "text",
    "max_uses" integer DEFAULT 1,
    "use_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    CONSTRAINT "collaborator_has_identity" CHECK ((("user_id" IS NOT NULL) OR ("invite_email" IS NOT NULL))),
    CONSTRAINT "tournament_collaborators_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'co-admin'::"text", 'trainer'::"text", 'collaborator'::"text", 'viewer'::"text"])))
);


COMMENT ON TABLE "public"."tournament_collaborators" IS 'Tournament members and pending invitations. Replaces localStorage-based invitationService and membershipService.';


CREATE TABLE IF NOT EXISTS "public"."tournament_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sport" "text" DEFAULT 'football'::"text" NOT NULL,
    "config" "jsonb" NOT NULL,
    "team_names" "jsonb",
    "tags" "text"[],
    "times_used" integer DEFAULT 0,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_public" boolean DEFAULT false,
    "share_code" "text",
    "title" "text" NOT NULL,
    "sport" "text" DEFAULT 'football'::"text" NOT NULL,
    "tournament_type" "text" DEFAULT 'classic'::"text" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "location_name" "text",
    "location_street" "text",
    "location_city" "text",
    "location_postal_code" "text",
    "location_country" "text" DEFAULT 'Deutschland'::"text",
    "number_of_fields" integer DEFAULT 1 NOT NULL,
    "number_of_teams" integer NOT NULL,
    "number_of_groups" integer DEFAULT 1,
    "group_phase_duration" integer NOT NULL,
    "group_phase_break" integer DEFAULT 2,
    "final_round_duration" integer,
    "final_round_break" integer,
    "point_system" "jsonb" DEFAULT '{"win": 3, "draw": 1, "loss": 0}'::"jsonb" NOT NULL,
    "finals_config" "jsonb",
    "referee_config" "jsonb",
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1,
    "last_modified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "share_code_created_at" timestamp with time zone,
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'live'::"text", 'completed'::"text", 'archived'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "tournaments_tournament_type_check" CHECK (("tournament_type" = ANY (ARRAY['classic'::"text", 'miniFussball'::"text", 'league'::"text", 'knockout'::"text"]))),
    CONSTRAINT "valid_share_code" CHECK ((("share_code" IS NULL) OR ("share_code" ~ '^[A-Z0-9]{6}$'::"text"))),
    CONSTRAINT "valid_team_count" CHECK ((("number_of_teams" >= 2) AND ("number_of_teams" <= 32)))
);


ALTER TABLE ONLY "public"."match_corrections"
    ADD CONSTRAINT "match_corrections_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."monitor_heartbeats"
    ADD CONSTRAINT "monitor_heartbeats_pkey" PRIMARY KEY ("monitor_id");


ALTER TABLE ONLY "public"."monitors"
    ADD CONSTRAINT "monitors_access_code_key" UNIQUE ("access_code");


ALTER TABLE ONLY "public"."monitors"
    ADD CONSTRAINT "monitors_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."sponsors"
    ADD CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."sync_queue"
    ADD CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_team_id_number_key" UNIQUE ("team_id", "number");


ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_tournament_id_name_key" UNIQUE ("tournament_id", "name");


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_invite_code_key" UNIQUE ("invite_code");


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_tournament_id_invite_email_key" UNIQUE ("tournament_id", "invite_email");


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");


ALTER TABLE ONLY "public"."tournament_templates"
    ADD CONSTRAINT "tournament_templates_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_share_code_key" UNIQUE ("share_code");


CREATE INDEX "idx_collaborators_invite_code" ON "public"."tournament_collaborators" USING "btree" ("invite_code") WHERE ("invite_code" IS NOT NULL);


CREATE INDEX "idx_collaborators_tournament" ON "public"."tournament_collaborators" USING "btree" ("tournament_id");


CREATE INDEX "idx_collaborators_user" ON "public"."tournament_collaborators" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


CREATE INDEX "idx_corrections_match" ON "public"."match_corrections" USING "btree" ("match_id");


CREATE INDEX "idx_match_corrections_corrected_by" ON "public"."match_corrections" USING "btree" ("corrected_by") WHERE ("corrected_by" IS NOT NULL);


CREATE INDEX "idx_match_corrections_owner_id" ON "public"."match_corrections" USING "btree" ("owner_id");


CREATE INDEX "idx_match_events_match" ON "public"."match_events" USING "btree" ("match_id");


CREATE INDEX "idx_match_events_owner_id" ON "public"."match_events" USING "btree" ("owner_id");


CREATE INDEX "idx_match_events_player" ON "public"."match_events" USING "btree" ("player_id") WHERE ("player_id" IS NOT NULL);


CREATE INDEX "idx_match_events_team_id" ON "public"."match_events" USING "btree" ("team_id") WHERE ("team_id" IS NOT NULL);


CREATE INDEX "idx_match_events_timestamp" ON "public"."match_events" USING "btree" ("match_id", "timestamp_seconds");


CREATE INDEX "idx_match_events_type" ON "public"."match_events" USING "btree" ("type");


CREATE INDEX "idx_matches_last_modified_by" ON "public"."matches" USING "btree" ("last_modified_by") WHERE ("last_modified_by" IS NOT NULL);


CREATE INDEX "idx_matches_live_state_active" ON "public"."matches" USING "btree" ("tournament_id") WHERE (("live_state" IS NOT NULL) AND ("match_status" = ANY (ARRAY['running'::"text", 'paused'::"text"])));


CREATE INDEX "idx_matches_owner_id" ON "public"."matches" USING "btree" ("owner_id");


CREATE INDEX "idx_matches_referee_team_id" ON "public"."matches" USING "btree" ("referee_team_id") WHERE ("referee_team_id" IS NOT NULL);


CREATE INDEX "idx_matches_status" ON "public"."matches" USING "btree" ("match_status");


CREATE INDEX "idx_matches_team_a_id" ON "public"."matches" USING "btree" ("team_a_id");


CREATE INDEX "idx_matches_team_b_id" ON "public"."matches" USING "btree" ("team_b_id");


CREATE INDEX "idx_matches_tournament" ON "public"."matches" USING "btree" ("tournament_id");


CREATE INDEX "idx_matches_tournament_phase" ON "public"."matches" USING "btree" ("tournament_id", "phase", "round");


CREATE INDEX "idx_matches_tournament_status" ON "public"."matches" USING "btree" ("tournament_id", "match_status");


CREATE INDEX "idx_monitor_heartbeats_tournament" ON "public"."monitor_heartbeats" USING "btree" ("tournament_id");


CREATE INDEX "idx_monitors_owner_id" ON "public"."monitors" USING "btree" ("owner_id");


CREATE INDEX "idx_monitors_tournament" ON "public"."monitors" USING "btree" ("tournament_id");


CREATE INDEX "idx_sponsors_owner_id" ON "public"."sponsors" USING "btree" ("owner_id");


CREATE INDEX "idx_sponsors_tournament" ON "public"."sponsors" USING "btree" ("tournament_id");


CREATE INDEX "idx_team_players_goals" ON "public"."team_players" USING "btree" ("team_id", "goals" DESC);


CREATE INDEX "idx_team_players_team" ON "public"."team_players" USING "btree" ("team_id");


CREATE INDEX "idx_teams_group" ON "public"."teams" USING "btree" ("tournament_id", "group_letter");


CREATE INDEX "idx_teams_owner_id" ON "public"."teams" USING "btree" ("owner_id");


CREATE INDEX "idx_teams_tournament" ON "public"."teams" USING "btree" ("tournament_id");


CREATE INDEX "idx_tournament_collaborators_invited_by" ON "public"."tournament_collaborators" USING "btree" ("invited_by") WHERE ("invited_by" IS NOT NULL);


CREATE INDEX "idx_tournaments_last_modified_by" ON "public"."tournaments" USING "btree" ("last_modified_by") WHERE ("last_modified_by" IS NOT NULL);


CREATE INDEX "idx_tournaments_owner" ON "public"."tournaments" USING "btree" ("owner_id");


CREATE INDEX "idx_tournaments_public" ON "public"."tournaments" USING "btree" ("is_public") WHERE ("is_public" = true);


CREATE INDEX "idx_tournaments_share_code" ON "public"."tournaments" USING "btree" ("share_code") WHERE ("share_code" IS NOT NULL);


CREATE OR REPLACE TRIGGER "match_corrections_sync_owner" BEFORE INSERT ON "public"."match_corrections" FOR EACH ROW EXECUTE FUNCTION "public"."sync_owner_from_match"();


CREATE OR REPLACE TRIGGER "match_event_version_trigger" BEFORE UPDATE ON "public"."match_events" FOR EACH ROW EXECUTE FUNCTION "public"."increment_match_event_version"();


CREATE OR REPLACE TRIGGER "match_events_sync_owner" BEFORE INSERT ON "public"."match_events" FOR EACH ROW EXECUTE FUNCTION "public"."sync_owner_from_match"();


CREATE OR REPLACE TRIGGER "matches_sync_owner" BEFORE INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_owner_from_tournament"();


CREATE OR REPLACE TRIGGER "matches_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "monitor_version_trigger" BEFORE UPDATE ON "public"."monitors" FOR EACH ROW EXECUTE FUNCTION "public"."increment_monitor_version"();


CREATE OR REPLACE TRIGGER "monitors_sync_owner" BEFORE INSERT ON "public"."monitors" FOR EACH ROW EXECUTE FUNCTION "public"."sync_owner_from_tournament"();


CREATE OR REPLACE TRIGGER "monitors_updated_at" BEFORE UPDATE ON "public"."monitors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "on_match_event_soft_delete" AFTER UPDATE OF "is_deleted" ON "public"."match_events" FOR EACH ROW EXECUTE FUNCTION "public"."revert_stats_on_event_delete"();


CREATE OR REPLACE TRIGGER "on_match_event_sync_score" AFTER INSERT ON "public"."match_events" FOR EACH ROW WHEN (("new"."is_deleted" = false)) EXECUTE FUNCTION "public"."sync_match_score_from_event"();


CREATE OR REPLACE TRIGGER "on_match_event_update_player_stats" AFTER INSERT ON "public"."match_events" FOR EACH ROW WHEN (("new"."is_deleted" = false)) EXECUTE FUNCTION "public"."update_player_stats_from_event"();


CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "sponsor_version_trigger" BEFORE UPDATE ON "public"."sponsors" FOR EACH ROW EXECUTE FUNCTION "public"."increment_sponsor_version"();


CREATE OR REPLACE TRIGGER "sponsors_sync_owner" BEFORE INSERT ON "public"."sponsors" FOR EACH ROW EXECUTE FUNCTION "public"."sync_owner_from_tournament"();


CREATE OR REPLACE TRIGGER "sponsors_updated_at" BEFORE UPDATE ON "public"."sponsors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "team_players_updated_at" BEFORE UPDATE ON "public"."team_players" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "team_version_trigger" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."increment_team_version"();


CREATE OR REPLACE TRIGGER "teams_sync_owner" BEFORE INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."sync_owner_from_tournament"();


CREATE OR REPLACE TRIGGER "teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "tournament_templates_updated_at" BEFORE UPDATE ON "public"."tournament_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


CREATE OR REPLACE TRIGGER "tournament_visibility_cascade" AFTER UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_tournament_visibility"();


CREATE OR REPLACE TRIGGER "tournaments_enforce_release_before_public" BEFORE INSERT OR UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_release_before_public"();


CREATE OR REPLACE TRIGGER "tournaments_updated_at" BEFORE UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


ALTER TABLE ONLY "public"."match_corrections"
    ADD CONSTRAINT "match_corrections_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "auth"."users"("id");


ALTER TABLE ONLY "public"."match_corrections"
    ADD CONSTRAINT "match_corrections_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."team_players"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "auth"."users"("id");


ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_referee_team_id_fkey" FOREIGN KEY ("referee_team_id") REFERENCES "public"."teams"("id");


ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."monitor_heartbeats"
    ADD CONSTRAINT "monitor_heartbeats_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."monitor_heartbeats"
    ADD CONSTRAINT "monitor_heartbeats_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."monitors"
    ADD CONSTRAINT "monitors_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."sponsors"
    ADD CONSTRAINT "sponsors_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."sync_queue"
    ADD CONSTRAINT "sync_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."tournament_collaborators"
    ADD CONSTRAINT "tournament_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."tournament_templates"
    ADD CONSTRAINT "tournament_templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "auth"."users"("id");


ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


CREATE POLICY "collaborators_delete_v3" ON "public"."tournament_collaborators" FOR DELETE TO "authenticated", "anon" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."user_owns_tournament"("tournament_id")));


CREATE POLICY "collaborators_insert_v3" ON "public"."tournament_collaborators" FOR INSERT TO "authenticated", "anon" WITH CHECK ("public"."user_owns_tournament"("tournament_id"));


CREATE POLICY "collaborators_select_v3" ON "public"."tournament_collaborators" FOR SELECT TO "authenticated", "anon" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("invite_email" = ( SELECT "auth"."email"() AS "email")) OR "public"."user_owns_tournament"("tournament_id")));


CREATE POLICY "collaborators_update_v3" ON "public"."tournament_collaborators" FOR UPDATE TO "authenticated", "anon" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("invite_email" = ( SELECT "auth"."email"() AS "email")) OR "public"."user_owns_tournament"("tournament_id"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("invite_email" = ( SELECT "auth"."email"() AS "email")) OR "public"."user_owns_tournament"("tournament_id")));


ALTER TABLE "public"."match_corrections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_corrections_delete_v2" ON "public"."match_corrections" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "match_corrections_insert_v2" ON "public"."match_corrections" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_corrections"."match_id") AND ("matches"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "match_corrections_select_v2" ON "public"."match_corrections" FOR SELECT USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id")));


CREATE POLICY "match_corrections_update_v2" ON "public"."match_corrections" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


ALTER TABLE "public"."match_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_events_delete_v2" ON "public"."match_events" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "match_events_insert_v3" ON "public"."match_events" FOR INSERT TO "authenticated", "anon" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM ("public"."matches" "m"
     JOIN "public"."tournament_collaborators" "tc" ON (("tc"."tournament_id" = "m"."tournament_id")))
  WHERE (("m"."id" = "match_events"."match_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL))))));


CREATE POLICY "match_events_select_v3" ON "public"."match_events" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id")));


CREATE POLICY "match_events_update_v2" ON "public"."match_events" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_delete_v2" ON "public"."matches" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "matches_insert_v2" ON "public"."matches" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "matches"."tournament_id") AND ("tournaments"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "matches_select_v3" ON "public"."matches" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "matches"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL))))));


CREATE POLICY "matches_update_v3" ON "public"."matches" FOR UPDATE TO "authenticated", "anon" USING (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "matches"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL)))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "matches"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL))))));


ALTER TABLE "public"."monitor_heartbeats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monitors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "monitors_delete_v2" ON "public"."monitors" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "monitors_insert_v2" ON "public"."monitors" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "monitors"."tournament_id") AND ("tournaments"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "monitors_select_v3" ON "public"."monitors" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id")));


CREATE POLICY "monitors_update_v2" ON "public"."monitors" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "owner_select_heartbeats" ON "public"."monitor_heartbeats" FOR SELECT USING (("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."owner_id" = "auth"."uid"()))));


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_all" ON "public"."profiles" FOR SELECT USING (true);


CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));


ALTER TABLE "public"."sponsors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sponsors_delete_v2" ON "public"."sponsors" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "sponsors_insert_v2" ON "public"."sponsors" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "sponsors"."tournament_id") AND ("tournaments"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "sponsors_select_v3" ON "public"."sponsors" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id")));


CREATE POLICY "sponsors_update_v2" ON "public"."sponsors" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


ALTER TABLE "public"."sync_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sync_queue_all_own" ON "public"."sync_queue" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


ALTER TABLE "public"."team_players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_players_delete_v3" ON "public"."team_players" FOR DELETE TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "team_players_insert_v3" ON "public"."team_players" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND (("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."tournament_collaborators" "tc"
          WHERE (("tc"."tournament_id" = "t"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL)))))))));


CREATE POLICY "team_players_select_v3" ON "public"."team_players" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND (("t"."is_public" = true) OR ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));


CREATE POLICY "team_players_update_v3" ON "public"."team_players" FOR UPDATE TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_players"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete_v2" ON "public"."teams" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "teams_insert_v2" ON "public"."teams" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "teams"."tournament_id") AND ("tournaments"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));


CREATE POLICY "teams_select_v3" ON "public"."teams" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "teams"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL))))));


CREATE POLICY "teams_update_v3" ON "public"."teams" FOR UPDATE TO "authenticated", "anon" USING (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "teams"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL)))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "teams"."tournament_id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL))))));


CREATE POLICY "templates_delete_v3" ON "public"."tournament_templates" FOR DELETE TO "authenticated", "anon" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));


CREATE POLICY "templates_insert_v3" ON "public"."tournament_templates" FOR INSERT TO "authenticated", "anon" WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));


CREATE POLICY "templates_select_v3" ON "public"."tournament_templates" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR ("owner_id" = ( SELECT "auth"."uid"() AS "uid"))));


CREATE POLICY "templates_update_v3" ON "public"."tournament_templates" FOR UPDATE TO "authenticated", "anon" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));


ALTER TABLE "public"."tournament_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_delete_v2" ON "public"."tournaments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));


CREATE POLICY "tournaments_insert_v3" ON "public"."tournaments" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") AND ((NOT "public"."is_anonymous_user"()) OR ("public"."count_active_tournaments"(( SELECT "auth"."uid"() AS "uid")) < "public"."anonymous_tournament_limit"()))));


CREATE POLICY "tournaments_select_v3" ON "public"."tournaments" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "tournaments"."id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."accepted_at" IS NOT NULL))))));


CREATE POLICY "tournaments_update_v3" ON "public"."tournaments" FOR UPDATE TO "authenticated", "anon" USING (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "tournaments"."id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."role" = 'admin'::"text") AND ("tc"."accepted_at" IS NOT NULL)))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "owner_id") OR (EXISTS ( SELECT 1
   FROM "public"."tournament_collaborators" "tc"
  WHERE (("tc"."tournament_id" = "tournaments"."id") AND ("tc"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tc"."role" = 'admin'::"text") AND ("tc"."accepted_at" IS NOT NULL))))));


