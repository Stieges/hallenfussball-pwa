-- supabase/migrations/20261124_002_leibchen_schritt2.sql
-- Leibchen Schritt 2a "Server und Modell" (Befunde C-LEIBCHEN-VOR-ANPFIFF-SCHRITT2, C-COCKPIT-LEIBCHEN-NACHTRAGEN-FEHLT):
-- Die Wahl der Leibchen bekommt einen Zustand und einen Weg zum Server -- vor dem Anpfiff ("Bestaetigen", "Keine Leibchen",
-- "Aendern", schon im Endstand des Spiels davor) und im laufenden Spiel (Nachtragen, Entfernen, Seite wechseln durch die
-- Turnierleitung). Die Oberflaeche (Karte, Zeile, Nachtragen unter "Mehr") ist Schritt 2b; diese Migration ist ihr Server.
-- Szenarien (docs/anforderungen/2026-10-02_spiel-leiten.md): @SL-150 (im laufenden Spiel nur die Turnierleitung, Zustand live,
--   beendetes Spiel gesperrt), @SL-201 (Bestaetigen zeigt ueberall), @SL-202 (nur das steuernde Geraet, erst wenn der Server es
--   kennt), @SL-208/@SL-209 (Aendern: nur eine Seite traegt), @SL-210/@SL-214 (Anpfiff ohne Tipp, Anpfiff rueckgaengig),
--   @SL-212/@SL-235 (anderes Team auf der Seite: Wahl zurueckgenommen), @SL-213 (Rechte wie Anpfiff), @SL-215/@SL-216
--   (Endstand des Vorgaengers setzt das naechste Spiel; Zustand uebersteht Neuladen und Uebernahme), @SL-220 (drei Zustaende),
--   @SL-227 (freies Feld: jedes Geraet mit Recht, auch Helfer eines anderen Felds), @SL-228 (zuletzt beim Server angekommen
--   gewinnt), @SL-229 (Abweisung, wenn inzwischen ein anderes Geraet das Feld steuert oder andere Teams spielen), @SL-236
--   (Vorab-Festlegung fuer ein spaeteres Spiel durch Turnierleitung und Co-Admin, Server-Teil; Bedienung ist MVP+);
--   Anzeige @ZM-195, @ZM-200, @ZM-201 (Monitor und Zuschauer lesen weiter nur bib_side und kit_color_x); @W3-028 (Trikotfarbe
--   am Turniertag aendern: bestaetigte Wahl bleibt, deshalb speichert die Bestaetigung nur die Leibchenfarbe).
--
-- Inhalt:
--   1. matches.kit_decision text, drei Zustaende: NULL = offen (nichts getippt), 'none' = "Keine Leibchen" (getippt), 'bib' =
--      bestaetigt; Pruefregel matches_kit_decision_valid. Bestand: NULL. Monitor und Zuschauer-Seite lesen die Spalte NICHT
--      (Positivliste unveraendert).
--   2. matches_guard_kit_columns (Fassung 20261028_004 + kit_decision): Client-Rollen setzen die Spalte weder im INSERT noch im
--      UPDATE (HF003).
--   3. matches_kit_from_match_start (Fassung 20261028_004 + kit_decision): der Anpfiff setzt den Zustand nur, wenn er etwas
--      entscheidet. Mit Leibchen (kit.bibSide a|b) 'bib'. Ist die Wahl schon bestaetigt und der Anpfiff nennt nichts zum
--      Leibchen (kein Schluessel bibSide), bleibt sie stehen: Seite und Leibchenfarbe bleiben, die uebrige Seite bekommt die
--      Trikotfarbe des Anpfiffs (Ableitung, gilt nach Vorschlag). 'none' entsteht beim Anpfiff nur ausdruecklich (kit.bibSide
--      = JSON null) oder aus offen nie -- ohne Leibchen-Angabe und ohne Tipp bleibt der Zustand wie er war (NULL, @SL-210;
--      none bleibt none). Damit zeigt die Karte nach "Anpfiff rueckgaengig" den Stand davor (@SL-214).
--   4. public.match_kit_set(p_match_id, p_decision, p_kit, p_device_id, p_control_epoch): die Wahl schreiben.
--        p_decision 'bib'  + p_kit {"bibSide": "a"|"b", "bibColor": "#RRGGBB" [, "teamA": uuid, "teamB": uuid]}
--        p_decision 'none' + p_kit NULL oder nur {"teamA": uuid, "teamB": uuid}
--        teamA/teamB (beide oder keines) nennen die Teams, die das Geraet beim Waehlen auf den Seiten sah; stehen inzwischen
--        andere Teams im Spiel, weist der Server ab (TEAMS_CHANGED, @SL-229 Zeile 2).
--      Pruefreihenfolge:
--        a. Recht: writeMatchData, leadMatches oder manageSchedule. Kein Recht, kein Spiel, Turnier im Papierkorb, nicht
--           angemeldet: derselbe Fehler 42501.
--        b. Form (22023): decision nur bib/none, kit nur mit den erlaubten Schluesseln, bibSide a|b, bibColor #RRGGBB.
--        c. Spiel sperren; zwei Teams noetig (22023, "Teams noch offen" hat keine Karte); Turnier abgeschlossen: 55000.
--        d. Zustand des Spiels:
--           - beendet oder ausgefallen (finished, skipped): {rejected, MATCH_FINISHED | MATCH_SKIPPED}, nichts geaendert (@SL-150).
--           - laufend (running, paused = Zustand "live"): nur leadMatches (Turnierleitung, Co-Admin) -- ohne Pruefung auf das
--             steuernde Geraet und ohne Epoche; Helfer: {rejected, LEAD_ONLY} (@SL-150). Das Nachtragen setzt die Seite und
--             ihre Leibchenfarbe; die Trikotfarbe einer Seite, die ihr Leibchen verliert, kommt aus der Teamfarbe.
--           - noch nicht angepfiffen (scheduled, waiting): ist es NICHT das naechste Spiel seines Felds (das erste noch nicht
--             beendete Spiel mit zwei Teams nach scheduled_start, round, slot, match_number -- solange ein Spiel des Felds
--             laeuft, ist es das laufende, das naechste folgt erst nach dem Abpfiff), ist es eine Vorab-Festlegung:
--             nur manageSchedule (Turnierleitung, Co-Admin), ohne Pruefung auf das steuernde Geraet, auch wenn ein anderes
--             Geraet das Feld haelt (@SL-236); Helfer: {rejected, NOT_NEXT_MATCH}. Fuer das naechste Spiel gilt: haelt ein
--             Geraet das Feld, nur dieses (anderes Geraet {rejected, NOT_CONTROLLER, detail OTHER_DEVICE}, alte Epoche
--             STALE_EPOCH, beide mit field_control_info; @SL-202, @SL-213, @SL-229); ein freies Feld bleibt frei -- jedes Geraet
--             mit Recht darf bestaetigen, auch der Helfer eines anderen Felds (@SL-227), und die Wahl begruendet keinen
--             Anspruch auf das Feld (field_control bleibt unveraendert).
--        e. teamA/teamB gegen die Teams im Spiel (TEAMS_CHANGED).
--        f. UPDATE matches. Der Waechter laesst den Eigentuemer der Funktion durch.
--      Antwort {status:'saved', phase:'before'|'live', decision, kit:{bibSide,bibColor}|null}. Mehrere Aufrufe: der zuletzt beim
--      Server angekommene gewinnt (Zeilensperre, @SL-228); Wiederholen mit denselben Daten ist harmlos.
--   5. matches_kit_reset_on_team_change (BEFORE UPDATE OF team_a_id, team_b_id): kommt vor dem Anpfiff ein anderes Team auf eine
--      Seite oder werden die Seiten getauscht, ist die Wahl zurueckgenommen -- kit_decision, bib_side, kit_color_a/b auf NULL
--      (@SL-212, @SL-235). Eine Trikotfarbe liegt nicht am Spiel (teams.color_primary): ihre Aenderung nimmt nichts zurueck
--      (@W3-028). Der Trigger heisst alphabetisch NACH matches_guard_kit_columns, damit der Waechter die Zuruecknahme nicht sieht.
--   Monitor, Zuschauer-Seite, Aenderungssignal: kein neuer Weg. Der Anweisungs-Trigger auf matches (20261118_006) sendet das
--   Signal, display_tournament/public_payload geben bib_side/kit_color_x schon aus (20261117_104).
--
-- Rechte: keine neue Tabelle, keine Policy, kein Tabellenrecht fuer Clients; rolePermissions.json unveraendert (kein neues
--   Recht). match_kit_set: EXECUTE nur authenticated (nicht anon, nicht service_role, nicht PUBLIC). Der Hilfsbaustein
--   match_kit_team_color ohne EXECUTE fuer Client-Rollen.
-- Voraussetzungen (Fail-fast unten): 20261028_004 (Spalten, beide Funktionen, Trigger), has_tournament_permission, field_control +
--   field_control_info (20261110_003), tournament_is_closed (20261113_003).
-- Fehlercodes: Standard-SQLSTATE (42501, 22023, 55000) und HF003 (Waechter); fachliche Ablehnungen als Antwortobjekt.
-- Bestandsdaten: keine Aenderung (neue Spalte NULL). Reihenfolge zur App: erst einspielen, dann mergen (die App ruft die
--   Funktion erst in Schritt 2b; Schritt 2a liest die Spalte, eine fehlende Spalte liest sie als offen).
-- Idempotent: ADD COLUMN IF NOT EXISTS, Pruefregel nur wenn sie fehlt, CREATE OR REPLACE, DROP TRIGGER IF EXISTS + CREATE,
--   REVOKE/GRANT.
-- Rueckweg: supabase/rollbacks/20261124_002_leibchen_schritt2_rollback.sql.
-- Beweis: scripts/leibchen-kit-check.sh (Szenario-Zeilen, Gegenbeispiele, Rueckweg, --gegenprobe mit Mutationen).

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.field_control_info(uuid,integer,uuid)') IS NULL
     OR to_regprocedure('public.tournament_is_closed(uuid)') IS NULL
     OR to_regprocedure('public.matches_guard_kit_columns()') IS NULL
     OR to_regprocedure('public.matches_kit_from_match_start()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'bib_side') THEN
    RAISE EXCEPTION '20261124_002_leibchen_schritt2: 20261028_004 (Leibchen-Spalten und -Funktionen), 20261110_003 (field_control) oder 20261113_003 (tournament_is_closed) fehlen -- zuerst diese einspielen';
  END IF;
END;
$$;

-- 1. Dritter Zustand der Wahl: NULL offen, 'none' "Keine Leibchen", 'bib' bestaetigt.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS kit_decision text;
COMMENT ON COLUMN public.matches.kit_decision IS 'Wahl der Leibchen: NULL offen, none = Keine Leibchen, bib = bestaetigt; nur Server (match_kit_set, Anpfiff).';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_kit_decision_valid' AND conrelid = 'public.matches'::regclass) THEN
    ALTER TABLE public.matches ADD CONSTRAINT matches_kit_decision_valid
      CHECK (kit_decision IS NULL OR kit_decision IN ('bib', 'none')) NOT VALID;
    ALTER TABLE public.matches VALIDATE CONSTRAINT matches_kit_decision_valid;
  END IF;
END;
$$;

-- 2. Waechter: Fassung 20261028_004, dazu kit_decision.
CREATE OR REPLACE FUNCTION public.matches_guard_kit_columns() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.kit_color_a  := NULL;
      NEW.kit_color_b  := NULL;
      NEW.bib_side     := NULL;
      NEW.kit_decision := NULL;
    ELSIF NEW.kit_color_a  IS DISTINCT FROM OLD.kit_color_a
       OR NEW.kit_color_b  IS DISTINCT FROM OLD.kit_color_b
       OR NEW.bib_side     IS DISTINCT FROM OLD.bib_side
       OR NEW.kit_decision IS DISTINCT FROM OLD.kit_decision THEN
      RAISE EXCEPTION 'Getragene Farben setzt nur der Anpfiff (Spiel %)', OLD.id USING ERRCODE = 'HF003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_guard_kit_columns() FROM PUBLIC, anon, authenticated;

-- 3. Anpfiff-Projektion: Fassung 20261028_004, dazu kit_decision (Anpfiff ohne Angabe laesst eine Wahl und einen offenen Zustand
--    stehen, @SL-210, @SL-214; ausdrueckliches kit.bibSide null setzt 'none').
CREATE OR REPLACE FUNCTION public.matches_kit_from_match_start() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kit jsonb := NEW.payload -> 'kit';
  v_a   text;
  v_b   text;
  v_bib text;
  v_old text;
  v_none boolean;
  v_keep boolean;
BEGIN
  IF v_kit IS NULL OR jsonb_typeof(v_kit) <> 'object' THEN
    RETURN NULL;
  END IF;
  v_a   := upper(v_kit ->> 'a');
  v_b   := upper(v_kit ->> 'b');
  v_bib := v_kit ->> 'bibSide';
  IF v_a IS NOT NULL AND v_a !~ '^#[0-9A-F]{6}$' THEN v_a := NULL; END IF;
  IF v_b IS NOT NULL AND v_b !~ '^#[0-9A-F]{6}$' THEN v_b := NULL; END IF;
  IF v_bib IS NOT NULL AND v_bib NOT IN ('a', 'b') THEN v_bib := NULL; END IF;
  -- ausdrueckliches "keine Leibchen": der Schluessel bibSide steht da und ist JSON null
  v_none := v_kit ? 'bibSide' AND jsonb_typeof(v_kit -> 'bibSide') = 'null';
  SELECT m.kit_decision INTO v_old FROM public.matches m WHERE m.id = NEW.match_id;
  -- bestaetigte Wahl und der Anpfiff sagt nichts zum Leibchen: sie bleibt stehen
  v_keep := v_old = 'bib' AND v_bib IS NULL AND NOT v_none;
  UPDATE public.matches
     SET kit_color_a  = CASE WHEN v_keep AND bib_side = 'a' THEN kit_color_a ELSE v_a END,
         kit_color_b  = CASE WHEN v_keep AND bib_side = 'b' THEN kit_color_b ELSE v_b END,
         bib_side     = CASE WHEN v_keep THEN bib_side ELSE v_bib END,
         kit_decision = CASE WHEN v_bib IS NOT NULL OR v_keep THEN 'bib'
                             WHEN v_none THEN 'none'
                             ELSE kit_decision END
   WHERE id = NEW.match_id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_kit_from_match_start() FROM PUBLIC, anon, authenticated;

-- 4a. Teamfarbe (Trikot) eines Teams als #RRGGBB, sonst NULL. Intern.
CREATE OR REPLACE FUNCTION public.match_kit_team_color(p_team_id uuid) RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN t.color_primary ~ '^#[0-9A-Fa-f]{6}$' THEN upper(t.color_primary)
              WHEN t.color_primary ~ '^#[0-9A-Fa-f]{3}$' THEN upper('#' || substr(t.color_primary, 2, 1) || substr(t.color_primary, 2, 1)
                                                                        || substr(t.color_primary, 3, 1) || substr(t.color_primary, 3, 1)
                                                                        || substr(t.color_primary, 4, 1) || substr(t.color_primary, 4, 1))
         END
    FROM public.teams t WHERE t.id = p_team_id;
$$;
REVOKE ALL ON FUNCTION public.match_kit_team_color(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 4b. Die Wahl der Leibchen.
CREATE OR REPLACE FUNCTION public.match_kit_set(p_match_id uuid, p_decision text, p_kit jsonb DEFAULT NULL,
                                                p_device_id uuid DEFAULT NULL, p_control_epoch integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_tid       uuid;
  v_match     public.matches%ROWTYPE;
  v_fc        public.field_control%ROWTYPE;
  v_kit       jsonb := CASE WHEN p_kit IS NULL OR jsonb_typeof(p_kit) = 'null' THEN NULL ELSE p_kit END;
  v_write     boolean;
  v_lead      boolean;
  v_sched     boolean;
  v_side      text;
  v_color     text;
  v_team_a    uuid;
  v_team_b    uuid;
  v_next      uuid;
  v_new_a     text;
  v_new_b     text;
  v_phase     text;
  v_key       text;
BEGIN
  -- a. Recht. Kein Recht, kein Spiel, geloeschtes Turnier, nicht angemeldet: derselbe Fehler.
  SELECT m.tournament_id INTO v_tid
    FROM public.matches m JOIN public.tournaments t ON t.id = m.tournament_id
   WHERE m.id = p_match_id AND t.deleted_at IS NULL;
  IF v_uid IS NULL OR v_tid IS NULL THEN
    RAISE EXCEPTION 'match_kit_set: keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  v_write := public.has_tournament_permission(v_tid, 'writeMatchData');
  v_lead  := public.has_tournament_permission(v_tid, 'leadMatches');
  v_sched := public.has_tournament_permission(v_tid, 'manageSchedule');
  IF NOT (v_write OR v_lead OR v_sched) THEN
    RAISE EXCEPTION 'match_kit_set: keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  -- b. Form strikt (vor jeder Zustandspruefung, damit ein fehlerhafter Aufruf immer 22023 ist).
  IF p_decision IS NULL OR p_decision NOT IN ('bib', 'none') THEN
    RAISE EXCEPTION 'match_kit_set: decision muss bib oder none sein' USING ERRCODE = '22023';
  END IF;
  IF v_kit IS NOT NULL THEN
    IF jsonb_typeof(v_kit) <> 'object' THEN
      RAISE EXCEPTION 'match_kit_set: kit muss ein Objekt sein' USING ERRCODE = '22023';
    END IF;
    FOR v_key IN SELECT k.key FROM jsonb_object_keys(v_kit) AS k(key) LOOP
      IF v_key NOT IN ('teamA', 'teamB') AND NOT (p_decision = 'bib' AND v_key IN ('bibSide', 'bibColor')) THEN
        RAISE EXCEPTION 'match_kit_set: kit hat einen unerlaubten Schluessel (%)', v_key USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF (v_kit ? 'teamA') <> (v_kit ? 'teamB') THEN
      RAISE EXCEPTION 'match_kit_set: teamA und teamB nur zusammen' USING ERRCODE = '22023';
    END IF;
    IF v_kit ? 'teamA' THEN
      IF jsonb_typeof(v_kit -> 'teamA') <> 'string' OR jsonb_typeof(v_kit -> 'teamB') <> 'string'
         OR (v_kit ->> 'teamA') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR (v_kit ->> 'teamB') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'match_kit_set: teamA und teamB muessen Kennungen sein' USING ERRCODE = '22023';
      END IF;
      v_team_a := (v_kit ->> 'teamA')::uuid;
      v_team_b := (v_kit ->> 'teamB')::uuid;
    END IF;
  END IF;
  IF p_decision = 'bib' THEN
    IF v_kit IS NULL OR jsonb_typeof(v_kit -> 'bibSide') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_kit -> 'bibColor') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'match_kit_set: kit muss bibSide und bibColor enthalten' USING ERRCODE = '22023';
    END IF;
    v_side  := v_kit ->> 'bibSide';
    v_color := upper(v_kit ->> 'bibColor');
    IF v_side NOT IN ('a', 'b') OR v_color !~ '^#[0-9A-F]{6}$' THEN
      RAISE EXCEPTION 'match_kit_set: bibSide a|b und bibColor #RRGGBB sind Pflicht' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- c. Spiel sperren; zwei Teams noetig; Turnier offen.
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_kit_set: keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'match_kit_set: Spiel % hat noch keine zwei Teams', p_match_id USING ERRCODE = '22023';
  END IF;
  IF public.tournament_is_closed(v_tid) THEN
    RAISE EXCEPTION 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (match_kit_set, Turnier %).', v_tid USING ERRCODE = '55000';
  END IF;

  -- d. Zustand des Spiels.
  IF v_match.match_status = 'finished' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'MATCH_FINISHED');
  ELSIF v_match.match_status = 'skipped' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'MATCH_SKIPPED');
  ELSIF v_match.match_status IN ('running', 'paused') THEN
    v_phase := 'live';
    IF NOT v_lead THEN
      RETURN jsonb_build_object('status', 'rejected', 'code', 'LEAD_ONLY');
    END IF;
  ELSE
    v_phase := 'before';
    SELECT m.id INTO v_next
      FROM public.matches m
     WHERE m.tournament_id = v_match.tournament_id AND m.field = v_match.field
       AND m.match_status IN ('scheduled', 'waiting', 'running', 'paused')
       AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
     ORDER BY m.scheduled_start NULLS LAST, m.round, m.slot NULLS LAST, m.match_number NULLS LAST, m.id
     LIMIT 1;
    IF v_next IS DISTINCT FROM p_match_id THEN
      -- Vorab-Festlegung fuer ein spaeteres Spiel: nur Turnierleitung und Co-Admin, ohne Pruefung auf das steuernde Geraet.
      IF NOT v_sched THEN
        RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_NEXT_MATCH');
      END IF;
    ELSE
      -- Das naechste Spiel: haelt ein Geraet das Feld, bedient nur dieses die Wahl. Ein freies Feld bleibt frei (kein Anspruch).
      SELECT * INTO v_fc FROM public.field_control
       WHERE tournament_id = v_match.tournament_id AND field = v_match.field;
      IF FOUND AND v_fc.holder_user_id IS NOT NULL THEN
        IF NOT coalesce(v_fc.holder_user_id = v_uid AND v_fc.holder_device_id = p_device_id, false) THEN
          RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_CONTROLLER',
            'detail', jsonb_build_object('reason', 'OTHER_DEVICE')
                      || public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
        ELSIF p_control_epoch IS NOT NULL AND p_control_epoch <> v_fc.epoch THEN
          RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_CONTROLLER',
            'detail', jsonb_build_object('reason', 'STALE_EPOCH')
                      || public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
        END IF;
      END IF;
    END IF;
  END IF;

  -- e. Andere Teams auf den Seiten als beim Waehlen: abweisen (@SL-229, @SL-212).
  IF v_team_a IS NOT NULL AND (v_team_a <> v_match.team_a_id OR v_team_b <> v_match.team_b_id) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'TEAMS_CHANGED');
  END IF;

  -- f. Schreiben (der Waechter laesst den Eigentuemer der Funktion durch).
  IF v_phase = 'before' THEN
    IF p_decision = 'none' THEN
      UPDATE public.matches
         SET kit_color_a = NULL, kit_color_b = NULL, bib_side = NULL, kit_decision = 'none'
       WHERE id = p_match_id;
    ELSE
      -- Vor dem Anpfiff traegt nur die Leibchen-Seite eine Farbe; die Trikotfarben kommen live aus den Teams (@W3-028).
      UPDATE public.matches
         SET bib_side     = v_side,
             kit_color_a  = CASE WHEN v_side = 'a' THEN v_color END,
             kit_color_b  = CASE WHEN v_side = 'b' THEN v_color END,
             kit_decision = 'bib'
       WHERE id = p_match_id;
    END IF;
  ELSE
    -- Laufendes Spiel: beide Seiten tragen schon eine festgehaltene Farbe. Die Seite mit neuem Leibchen nimmt die Leibchenfarbe,
    -- eine Seite, die ihr Leibchen verliert, ihre Teamfarbe; die uebrige Seite behaelt, was beim Anpfiff festgehalten wurde.
    v_new_a := CASE WHEN v_side = 'a' THEN v_color
                    WHEN v_match.bib_side = 'a' THEN public.match_kit_team_color(v_match.team_a_id)
                    ELSE v_match.kit_color_a END;
    v_new_b := CASE WHEN v_side = 'b' THEN v_color
                    WHEN v_match.bib_side = 'b' THEN public.match_kit_team_color(v_match.team_b_id)
                    ELSE v_match.kit_color_b END;
    UPDATE public.matches
       SET bib_side     = CASE WHEN p_decision = 'bib' THEN v_side END,
           kit_color_a  = v_new_a,
           kit_color_b  = v_new_b,
           kit_decision = p_decision
     WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('status', 'saved', 'phase', v_phase, 'decision', p_decision,
                            'kit', CASE WHEN p_decision = 'bib'
                                        THEN jsonb_build_object('bibSide', v_side, 'bibColor', v_color) END);
END;
$$;

REVOKE ALL ON FUNCTION public.match_kit_set(uuid, text, jsonb, uuid, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.match_kit_set(uuid, text, jsonb, uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.match_kit_set(uuid, text, jsonb, uuid, integer) IS
  'Wahl der Leibchen: bib (bestaetigen/aendern) oder none (Keine Leibchen) (@SL-201, @SL-202, @SL-215, @SL-227..@SL-229, @SL-236). Vor dem Anpfiff: Recht wie Anpfiff, nur steuerndes Geraet (freies Feld: jedes), Vorab-Festlegung nur Turnierleitung/Co-Admin. Laufend: nur leadMatches (@SL-150). Beendet: abgewiesen.';

-- 5. Wahl zurueckgenommen, wenn vor dem Anpfiff ein anderes Team auf eine Seite kommt oder die Seiten getauscht werden.
CREATE OR REPLACE FUNCTION public.matches_kit_reset_on_team_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.team_a_id IS DISTINCT FROM OLD.team_a_id OR NEW.team_b_id IS DISTINCT FROM OLD.team_b_id)
     AND coalesce(OLD.match_status, 'scheduled') IN ('scheduled', 'waiting')
     AND (OLD.kit_decision IS NOT NULL OR OLD.bib_side IS NOT NULL
          OR OLD.kit_color_a IS NOT NULL OR OLD.kit_color_b IS NOT NULL) THEN
    NEW.kit_decision := NULL;
    NEW.bib_side     := NULL;
    NEW.kit_color_a  := NULL;
    NEW.kit_color_b  := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_kit_reset_on_team_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_kit_reset_on_team_change ON public.matches;
CREATE TRIGGER matches_kit_reset_on_team_change
  BEFORE UPDATE OF team_a_id, team_b_id ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_kit_reset_on_team_change();

COMMIT;
