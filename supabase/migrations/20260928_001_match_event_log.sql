-- B2 (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B2-brief.md): Schema für das
-- Ereignis-Log, auf dem B3a (SQL-Rechenfunktion) und B3b (append_match_events) aufsetzen.
--
-- Rulings (verbindlich, siehe .superpowers/sdd/2026-09-25-pr-b-schreibweg/rulings.md und
-- progress.md): R6 (Ereignistypen), R7 (leadMatches), R13 (Direktweg abdichten), R14
-- (Pflichtspalten -- period-CHECK bleibt unveraendert, 'penalty' deckt shootout bereits ab),
-- R16 (Vorbereitung fuer E/F im Schema), R17 (Rechte), R19 (Alt-Trigger weg, Realtime-
-- Publikation). Ruling G1 (Controller, progress.md Zeile 22): R13 wird mit der etablierten
-- current_user-Ausnahme umgesetzt (Muster 20260922_003_protect_owner_and_roles.sql /
-- 20260923_001_protect_parent_keys.sql), NICHT mit einer set_config-GUC ("app.append_rpc") --
-- ein Client (Rolle authenticated/anon) kann eine GUC nie zuverlaessig NICHT setzen, current_user
-- wechselt dagegen innerhalb einer SECURITY-DEFINER-Funktion nachweislich auf deren Eigentuemer
-- (empirisch bestaetigt in 20260922_003, siehe deren Kopfkommentar ab Zeile 44) und ist fuer
-- einen PostgREST-Request (Rolle authenticated/anon) unveraenderlich.
--
-- Warum additiv: Die App schreibt bis PR C/D3 weiter wie bisher -- alte Ereignistypen (die
-- bestehenden 14 Werte), event_format IS NULL, keine der neuen Spalten gesetzt. Diese Migration
-- fuegt ausschliesslich NEUE, nullable Spalten (bis auf `seq`) und NEUE Tabellen hinzu; keine
-- bestehende Spalte wird umbenannt oder entfernt, keine bestehende Policy fuer die alten
-- Schreibpfade wird verschaerft. Der neue Guard-Trigger (Abschnitt 4) wirkt ausschliesslich auf
-- Zeilen, die entweder `event_format IS NOT NULL` setzen oder einen der 18 neuen Ereignistypen
-- verwenden -- fuer alte Zeilen/Typen ist er ein No-op.
--
-- Rueckweg: Diese Migration ist additiv und ohne Datenverlust rueckbaubar, SOLANGE keine Zeile
-- mit event_format IS NOT NULL geschrieben wurde (das passiert erst ab B3b, wenn die RPC existiert
-- -- B2 legt nur das Schema an, niemand schreibt hier bereits engine-foermige Zeilen). Ein Rueckweg
-- muesste: den Guard-Trigger droppen, die neuen Spalten droppen, match_event_authors/
-- match_transitions/app_config droppen, die role_permissions-Zeile ('co-admin','leadMatches')
-- loeschen und optional die beiden alten Trigger (on_match_event_sync_score/
-- on_match_event_soft_delete, siehe Abschnitt 1) wiederherstellen -- letzteres nur relevant, wenn
-- in der Zwischenzeit ueber die App-Wege (event_format IS NULL) neue GOAL/OWN_GOAL-Zeilen
-- entstanden sind, deren Punktestand dann nicht mehr automatisch synchronisiert wird.
--
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE durchgaengig, wie
-- 20260924_002_central_role_permissions.sql und 20260925_002_protect_matches_with_events.sql.
--
-- Nachweis: scripts/match-event-log-check.sh (Wegwerf-Container, Proben 1-10 inkl. Gegenprobe
-- OHNE diese Migration), task-B2-report.md.


-- ============================================================================================
-- 1. Alt-Trigger weg (R19)
-- ============================================================================================
--
-- on_match_event_sync_score (sync_match_score_from_event) und on_match_event_soft_delete
-- (revert_stats_on_event_delete) schreiben matches.score_a/score_b direkt aus AFTER-INSERT/
-- AFTER-UPDATE-Triggern auf match_events. Sobald die kuenftige RPC (B3b) selbst Punktestand-
-- Spalten auf matches schreibt (R15: "Zwischenspeicher einmal pro Stapel"), wuerde ein Alt-
-- Trigger jedes GOAL/OWN_GOAL zusaetzlich nochmal verrechnen -- doppelte Zaehlung. Beide
-- Funktionen werden HIER schon entfernt (B2), nicht erst in B3b, weil sie nur fuer GENAU diese
-- beiden Trigger existieren (siehe Beleg unten) und ein spaeteres Entfernen unnoetig zwei
-- Migrationen fuer dieselbe Aenderung braeuchte.
--
-- Beleg "kein anderer Trigger nutzt sie" (grep ueber alle Migrationsdateien inkl. Baseline):
-- sync_match_score_from_event() ist NUR an on_match_event_sync_score gebunden (Baseline Zeile
-- 1414), revert_stats_on_event_delete() NUR an on_match_event_soft_delete (Baseline Zeile 1411).
-- Keine dritte Referenz in supabase/migrations/*.sql.
--
-- on_match_event_update_player_stats (update_player_stats_from_event) BLEIBT unveraendert --
-- player_id ist auf match_events heute nie gesetzt (App-seitig nie befuellt), der Trigger ist
-- damit faktisch ein No-op, aber sein Entfernen ist nicht Teil dieses Auftrags.
--
-- Befund ins Ledger (Ruling R19, wie im Brief verlangt): Ein RETRACT (kuenftiges Ereignis, B1b)
-- nimmt die Spielerstatistik (team_players.goals/yellow_cards/...) NICHT zurueck, weil
-- update_player_stats_from_event nur auf INSERT reagiert und es (anders als der jetzt entfernte
-- revert_stats_on_event_delete) keine Gegenbuchung fuer eine Rueck- oder Korrekturbuchung gibt.
-- Auswirkung/Fix ist Sache eines spaeteren Tasks (Brief nennt "Auslöser C").

DROP TRIGGER IF EXISTS "on_match_event_sync_score" ON "public"."match_events";
DROP TRIGGER IF EXISTS "on_match_event_soft_delete" ON "public"."match_events";

DROP FUNCTION IF EXISTS "public"."sync_match_score_from_event"();
DROP FUNCTION IF EXISTS "public"."revert_stats_on_event_delete"();


-- ============================================================================================
-- 2. Neue Spalten auf match_events (R16), alle nullable ausser `seq`
-- ============================================================================================
--
-- `seq`: server-seitige, monoton steigende Reihenfolge (R3) -- IDENTITY statt eines manuell
-- gepflegten Zaehlers, damit sie niemals rueckwirkend aenderbar ist. Bestandszeilen bekommen beim
-- ADD COLUMN automatisch aufsteigende Werte (Postgres backfillt IDENTITY-Spalten wie SERIAL,
-- Reihenfolge = physische Zeilenreihenfolge, siehe Probe 9 im Harness).

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "seq" bigint GENERATED ALWAYS AS IDENTITY;

CREATE UNIQUE INDEX IF NOT EXISTS "match_events_seq_key" ON "public"."match_events" ("seq");

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "recorded_at" timestamptz DEFAULT now();

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "client_time" timestamptz;

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "clock_ms" integer;

ALTER TABLE "public"."match_events"
  DROP CONSTRAINT IF EXISTS "match_events_clock_ms_check";
ALTER TABLE "public"."match_events"
  ADD CONSTRAINT "match_events_clock_ms_check" CHECK ("clock_ms" IS NULL OR "clock_ms" >= 0);

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "section" smallint;

ALTER TABLE "public"."match_events"
  DROP CONSTRAINT IF EXISTS "match_events_section_check";
ALTER TABLE "public"."match_events"
  ADD CONSTRAINT "match_events_section_check" CHECK ("section" IS NULL OR "section" BETWEEN 1 AND 4);

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "target_event_id" uuid REFERENCES "public"."match_events"("id") ON DELETE RESTRICT;

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "base_seq" bigint;

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "review_state" text;

ALTER TABLE "public"."match_events"
  DROP CONSTRAINT IF EXISTS "match_events_review_state_check";
ALTER TABLE "public"."match_events"
  ADD CONSTRAINT "match_events_review_state_check"
    CHECK ("review_state" IS NULL OR "review_state" IN ('pending', 'accepted', 'discarded'));

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "event_format" smallint;

ALTER TABLE "public"."match_events"
  ADD COLUMN IF NOT EXISTS "control_epoch" integer;

COMMENT ON COLUMN "public"."match_events"."seq" IS
  'Server-Reihenfolge (R3), IDENTITY -- die zaehlende Menge aendert sich nie rueckwirkend (B-2).';
COMMENT ON COLUMN "public"."match_events"."event_format" IS
  'NULL = altes Ereignis (App-Schreibweg vor PR C/D3). Gesetzt (ab B3b: 1) = Ereignis der neuen
   Rechenfunktion, geschrieben ausschliesslich ueber append_match_events (Guard-Trigger unten).';
COMMENT ON COLUMN "public"."match_events"."target_event_id" IS
  'Zielereignis fuer RETRACT/CORRECTION/REVIEW_ACCEPT/REVIEW_DISCARD. ON DELETE RESTRICT: ein
   referenziertes Ereignis kann nicht geloescht werden, solange ein Verweis existiert (Ereignisse
   sind ohnehin unveraenderlich, siehe Guard-Trigger). Eindeutiger Teilindex unten fuer
   REVIEW_ACCEPT/REVIEW_DISCARD -- je Zielereignis darf es hoechstens eine Review-Entscheidung
   geben.';

CREATE INDEX IF NOT EXISTS "idx_match_events_match_seq" ON "public"."match_events" ("match_id", "seq");

CREATE UNIQUE INDEX IF NOT EXISTS "match_events_review_target_unique"
  ON "public"."match_events" ("target_event_id")
  WHERE "type" IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD');


-- ============================================================================================
-- 3. Typ-CHECK erweitern (R6)
-- ============================================================================================
--
-- Alle bisherigen 14 Werte (20260918_001_match_event_types.sql) PLUS jeder EventType aus
-- src/core/match/types.ts (EventTypeSchema), der dort noch nicht steht. Die 18 neuen Werte:
-- MATCH_START, PAUSE, RESUME, SECTION_END, SECTION_START, CLOCK_ADJUST, MATCH_END,
-- TIEBREAK_CHOICE, SHOOTOUT_KICK, SHOOTOUT_END, RETRACT, CORRECTION, REOPEN, SKIP, UNSKIP,
-- RESULT_ENTRY, REVIEW_ACCEPT, REVIEW_DISCARD. (GOAL, OWN_GOAL, YELLOW_CARD, YELLOW_RED_CARD,
-- RED_CARD, TIME_PENALTY, SUBSTITUTION, FOUL stehen bereits in der alten Liste -- die
-- Rechenfunktion nutzt fuer diese dieselben Bezeichner wie der Alt-Pfad, unterscheidet sich
-- ausschliesslich ueber event_format.)
--
-- period-CHECK bleibt UNVERAENDERT (R14): 'regular'/'overtime'/'penalty' deckt den
-- Shootout-Fall bereits als 'penalty' ab, keine SQL-Aenderung noetig.

ALTER TABLE "public"."match_events" DROP CONSTRAINT IF EXISTS "match_events_type_check";
ALTER TABLE "public"."match_events" ADD CONSTRAINT "match_events_type_check"
  CHECK ("type" = ANY (ARRAY[
    -- Alte 14 (20260918_001, unveraendert):
    'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
    'TIME_PENALTY', 'TIME_PENALTY_END', 'SUBSTITUTION', 'TIMEOUT', 'STATUS_CHANGE',
    'RESULT_EDIT', 'NOTE', 'FOUL', 'HALFTIME',
    -- Neue 18 (R6, src/core/match/types.ts#EventTypeSchema, deckungsgleich mit
    -- src/core/match/matchTransitions.json):
    'MATCH_START', 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST',
    'MATCH_END', 'TIEBREAK_CHOICE', 'SHOOTOUT_KICK', 'SHOOTOUT_END', 'RETRACT', 'CORRECTION',
    'REOPEN', 'SKIP', 'UNSKIP', 'RESULT_ENTRY', 'REVIEW_ACCEPT', 'REVIEW_DISCARD'
  ]::text[]));


-- ============================================================================================
-- 4. Unveraenderlichkeit + Direktweg abdichten (R13, Ruling G1)
-- ============================================================================================
--
-- Wechselwirkung mit vorhandenen Triggern auf match_events (geprueft, alle BEFORE, alle bleiben
-- unveraendert und laufen unabhaengig vom neuen Guard weiter):
--   - match_events_sync_owner (BEFORE INSERT, sync_owner_from_match): setzt owner_id/is_public
--     vom Elternspiel ab -- betrifft eine andere Spalte, keine Ueberschneidung.
--   - match_event_version_trigger (BEFORE UPDATE, increment_match_event_version): erhoeht
--     version/updated_at -- laeuft nur, wenn der Guard das UPDATE nicht schon abgelehnt hat
--     (Trigger-Reihenfolge innerhalb derselben Ausfuehrungsphase ist alphabetisch nach Name;
--     "match_event_version_trigger" < "match_events_guard_engine_rows" < "match_events_protect_*"
--     -- das spielt hier keine Rolle, weil ein RAISE EXCEPTION in JEDEM der Trigger die gesamte
--     Anweisung abbricht, unabhaengig von der Reihenfolge).
--   - match_events_protect_owner_id (BEFORE UPDATE, protect_owner_id): haelt owner_id fest,
--     kein RAISE -- keine Ueberschneidung.
--   - match_events_protect_match_id (BEFORE UPDATE, protect_parent_keys('match_id')): wirft bei
--     App-seitigem Umhaengen von match_id -- keine Ueberschneidung (andere Spalte).
--   - matches_protect_events_before_delete (20260925_002) sitzt auf `matches`, nicht auf
--     match_events -- betrifft diesen Guard nicht direkt, ist aber der Grund, warum die
--     Kaskaden-Ausnahme unten dasselbe Muster (pg_trigger_depth() > 1) braucht: Loeschen eines
--     Spiels MIT Ereignissen ist durch protect_matches_with_events bereits blockiert; die einzige
--     verbleibende Route zu einem DELETE auf match_events mit event_format IS NOT NULL ist die
--     Turnier-Kaskade (tournaments -> matches -> match_events, ON DELETE CASCADE, Baseline Zeile
--     ~1461) -- dort ist pg_trigger_depth() beim Erreichen von match_events 2 (die
--     matches-Kaskade selbst ist bereits Tiefe 1 innerhalb der tournaments-Loeschung), also > 1,
--     die Ausnahme greift. Siehe Kaskaden-Kommentar in 20260925_002 fuer die vollstaendige
--     Herleitung von pg_trigger_depth().
--
-- BEFORE INSERT: NEU (event_format IS NOT NULL) oder ein neuer Typ (nicht in der alten
-- 14er-Liste) ist nur erlaubt, wenn current_user NICHT authenticated/anon ist -- also aus einer
-- SECURITY-DEFINER-Funktion heraus (die kuenftige append_match_events-RPC, B3b). Muster identisch
-- zu 20260922_003_protect_owner_and_roles.sql (current_user-Ausnahme statt set_config-GUC,
-- Ruling G1).
--
-- BEFORE UPDATE/DELETE: eine Zeile mit OLD.event_format IS NOT NULL ist IMMER unveraenderlich --
-- auch fuer current_user ausserhalb authenticated/anon (also auch fuer eine kuenftige
-- SECURITY-DEFINER-Funktion). Engine-Zeilen werden nie upgedatet, nur durch neue Ereignisse
-- (RETRACT/CORRECTION/REVIEW_*) ergaenzt. Einzige Ausnahme: die Turnier-Kaskade beim Loeschen
-- (pg_trigger_depth() > 1, siehe oben).

CREATE OR REPLACE FUNCTION "public"."match_events_guard_engine_rows"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  legacy_types text[] := ARRAY[
    'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
    'TIME_PENALTY', 'TIME_PENALTY_END', 'SUBSTITUTION', 'TIMEOUT', 'STATUS_CHANGE',
    'RESULT_EDIT', 'NOTE', 'FOUL', 'HALFTIME'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.event_format IS NOT NULL OR NOT (NEW.type = ANY (legacy_types)))
       AND current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION
        'Nicht erlaubt: neue Ereignis-Zeilen (event_format gesetzt oder neuer Typ %) duerfen nur ueber append_match_events geschrieben werden.',
        NEW.type
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.event_format IS NOT NULL AND pg_trigger_depth() <= 1 THEN
      RAISE EXCEPTION
        'Nicht erlaubt: Ereignis-Zeilen der neuen Rechenfunktion (event_format gesetzt) sind unveraenderlich.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.event_format IS NOT NULL AND pg_trigger_depth() <= 1 THEN
      RAISE EXCEPTION
        'Nicht erlaubt: Ereignis-Zeilen der neuen Rechenfunktion (event_format gesetzt) koennen nur ueber eine Turnier-Loeschung (Kaskade) entfernt werden.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION "public"."match_events_guard_engine_rows"() IS
  'B2 (R13, Ruling G1): dichtet den Direktweg fuer die neue Rechenfunktion ab. INSERT einer
   Engine-Zeile (event_format gesetzt ODER ein neuer, nicht-legacy Ereignistyp) ist nur aus einer
   SECURITY-DEFINER-Funktion heraus erlaubt (current_user NICHT authenticated/anon -- Muster
   20260922_003_protect_owner_and_roles.sql, current_user statt session_user, siehe dortiger
   Kopfkommentar ab Zeile 44). UPDATE/DELETE einer Engine-Zeile ist IMMER verboten, auch fuer
   SECURITY-DEFINER-Aufrufer, ausser als Teil einer Turnier-Loeschungs-Kaskade
   (pg_trigger_depth() > 1, Muster 20260925_002_protect_matches_with_events.sql). Alte Zeilen
   (event_format IS NULL) und alte Typen bleiben unberuehrt bis D3.';

DROP TRIGGER IF EXISTS "match_events_guard_engine_rows" ON "public"."match_events";

CREATE TRIGGER "match_events_guard_engine_rows"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."match_events"
  FOR EACH ROW EXECUTE FUNCTION "public"."match_events_guard_engine_rows"();


-- ============================================================================================
-- 5. match_event_authors (R16/R17)
-- ============================================================================================
--
-- Wer ein Ereignis geschrieben hat -- nicht oeffentlich, weil match_events_select_v3 anon lesen
-- laesst (oeffentliche Turniere) und Autoreninformation (user_id/device_id) nicht Teil der
-- oeffentlichen Zuschaueransicht ist.

CREATE TABLE IF NOT EXISTS "public"."match_event_authors" (
  "event_id" uuid PRIMARY KEY REFERENCES "public"."match_events"("id") ON DELETE CASCADE,
  "tournament_id" uuid NOT NULL REFERENCES "public"."tournaments"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "device_id" uuid,
  "base_state" jsonb,
  "created_at" timestamptz DEFAULT now()
);

COMMENT ON TABLE "public"."match_event_authors" IS
  'B2 (R16/R17): Autorenschaft je Ereignis der neuen Rechenfunktion. NICHT oeffentlich (anders als
   match_events, das ueber match_events_select_v3 fuer anon lesbar ist) -- SELECT nur fuer
   Turnierleitung und Helfer (has_tournament_permission(tournament_id, writeMatchData)),
   authenticated only. Keine INSERT/UPDATE/DELETE-Policy: nur append_match_events (SECURITY
   DEFINER, B3b) schreibt hier. Nicht in der Realtime-Publikation (R17) -- kein Turnier-Leck
   ueber postgres_changes. device_id/control_epoch (auf match_events) werden von der RPC
   entgegengenommen, aber erst ab E tatsaechlich geprueft (R16).';

ALTER TABLE "public"."match_event_authors" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_event_authors_select" ON "public"."match_event_authors";

CREATE POLICY "match_event_authors_select" ON "public"."match_event_authors"
  FOR SELECT TO "authenticated"
  USING (
    "public"."has_tournament_permission"("tournament_id", 'writeMatchData')
  );

REVOKE ALL ON "public"."match_event_authors" FROM "anon", "authenticated";
GRANT SELECT ON "public"."match_event_authors" TO "authenticated";


-- ============================================================================================
-- 6. match_transitions -- Seed exakt aus src/core/match/matchTransitions.json (Ruling P1)
-- ============================================================================================

CREATE TABLE IF NOT EXISTS "public"."match_transitions" (
  "from_status" text NOT NULL,
  "event_type" text NOT NULL,
  "actor" text NOT NULL,
  "to_status" text NOT NULL,
  CONSTRAINT "match_transitions_pkey" PRIMARY KEY ("from_status", "event_type"),
  CONSTRAINT "match_transitions_actor_check" CHECK ("actor" IN ('helper', 'leitung'))
);

COMMENT ON TABLE "public"."match_transitions" IS
  'B2: Uebergangstabelle der Spiel-Rechenfunktion (R7 -- Akteur nur aus dieser Tabelle), Seed exakt
   aus src/core/match/matchTransitions.json (Ruling P1, B1a). AENDERUNGEN AN DIESER TABELLE:
   IMMER eine NEUE Migration (INSERT/UPDATE/DELETE) PLUS dieselbe Aenderung in der JSON --
   niemals diese Datei rueckwirkend editieren, Muster wie role_permissions
   (20260924_002_central_role_permissions.sql). Gleichlauf erzwungen von
   scripts/rls-role-matrix.sh und scripts/db-drift-check.sh.';

ALTER TABLE "public"."match_transitions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_transitions_select" ON "public"."match_transitions";

CREATE POLICY "match_transitions_select" ON "public"."match_transitions"
  FOR SELECT TO "anon", "authenticated"
  USING (true);

DROP POLICY IF EXISTS "match_transitions_select_ci_schema_reader" ON "public"."match_transitions";

CREATE POLICY "match_transitions_select_ci_schema_reader" ON "public"."match_transitions"
  FOR SELECT TO "ci_schema_reader"
  USING (true);

REVOKE ALL ON "public"."match_transitions" FROM "anon", "authenticated";
GRANT SELECT ON "public"."match_transitions" TO "anon", "authenticated", "ci_schema_reader";

INSERT INTO "public"."match_transitions" ("from_status", "event_type", "actor", "to_status") VALUES
  ('scheduled', 'MATCH_START', 'helper', 'running'),
  ('scheduled', 'SKIP', 'leitung', 'skipped'),
  ('scheduled', 'RESULT_ENTRY', 'leitung', 'finished'),
  ('running', 'GOAL', 'helper', '='),
  ('running', 'OWN_GOAL', 'helper', '='),
  ('running', 'YELLOW_CARD', 'helper', '='),
  ('running', 'YELLOW_RED_CARD', 'helper', '='),
  ('running', 'RED_CARD', 'helper', '='),
  ('running', 'TIME_PENALTY', 'helper', '='),
  ('running', 'FOUL', 'helper', '='),
  ('running', 'SUBSTITUTION', 'helper', '='),
  ('running', 'RETRACT', 'helper', '='),
  ('running', 'CLOCK_ADJUST', 'helper', '='),
  ('running', 'PAUSE', 'helper', 'paused'),
  ('running', 'SECTION_END', 'helper', 'section_break'),
  ('running', 'MATCH_END', 'helper', '@endcheck'),
  ('paused', 'RESUME', 'helper', 'running'),
  ('paused', 'YELLOW_CARD', 'helper', '='),
  ('paused', 'YELLOW_RED_CARD', 'helper', '='),
  ('paused', 'RED_CARD', 'helper', '='),
  ('paused', 'TIME_PENALTY', 'helper', '='),
  ('paused', 'SUBSTITUTION', 'helper', '='),
  ('paused', 'RETRACT', 'helper', '='),
  ('paused', 'CLOCK_ADJUST', 'helper', '='),
  ('paused', 'MATCH_END', 'helper', '@endcheck'),
  ('section_break', 'SECTION_START', 'helper', 'running'),
  ('section_break', 'YELLOW_CARD', 'helper', '='),
  ('section_break', 'YELLOW_RED_CARD', 'helper', '='),
  ('section_break', 'RED_CARD', 'helper', '='),
  ('section_break', 'SUBSTITUTION', 'helper', '='),
  ('section_break', 'RETRACT', 'helper', '='),
  ('decision_pending', 'TIEBREAK_CHOICE', 'helper', '='),
  ('shootout', 'SHOOTOUT_KICK', 'helper', '='),
  ('shootout', 'RETRACT', 'helper', '='),
  ('shootout', 'SHOOTOUT_END', 'helper', 'finished'),
  ('finished', 'CORRECTION', 'leitung', '='),
  ('finished', 'REOPEN', 'leitung', 'running'),
  ('finished', 'RETRACT', 'leitung', '='),
  ('skipped', 'UNSKIP', 'leitung', 'scheduled')
ON CONFLICT ("from_status", "event_type") DO NOTHING;


-- ============================================================================================
-- 7. app_config
-- ============================================================================================

CREATE TABLE IF NOT EXISTS "public"."app_config" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL
);

COMMENT ON TABLE "public"."app_config" IS
  'B2: kleine, oeffentlich lesbare Konfigurationstabelle. min_client_format (R16/R10-Umfeld):
   Mindest-Client-Format, das die App kuenftig fuer den Schreibweg voraussetzt.';

ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_select" ON "public"."app_config";

CREATE POLICY "app_config_select" ON "public"."app_config"
  FOR SELECT TO "anon", "authenticated"
  USING (true);

DROP POLICY IF EXISTS "app_config_select_ci_schema_reader" ON "public"."app_config";

CREATE POLICY "app_config_select_ci_schema_reader" ON "public"."app_config"
  FOR SELECT TO "ci_schema_reader"
  USING (true);

REVOKE ALL ON "public"."app_config" FROM "anon", "authenticated";
GRANT SELECT ON "public"."app_config" TO "anon", "authenticated", "ci_schema_reader";

INSERT INTO "public"."app_config" ("key", "value") VALUES
  ('min_client_format', '1')
ON CONFLICT ("key") DO NOTHING;


-- ============================================================================================
-- 8. Berechtigung leadMatches (R7)
-- ============================================================================================
--
-- "Turnierleitung im Spielbetrieb: Korrektur beendeter Spiele, Wiedereroeffnen, Ueberspringen,
-- Direkteintrag -- nur ueber append_match_events." Owner hat sie implizit (has_tournament_
-- permission() deckt den Eigentuemer immer ab, unabhaengig vom Inhalt von role_permissions,
-- siehe dortiger Funktionskommentar). Nur co-admin bekommt sie als Rolle -- collaborator/trainer/
-- viewer nicht (Brief nennt nur "Turnierleitung", das ist co-admin, nicht collaborator).

ALTER TABLE "public"."role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permission_check";
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_check"
  CHECK (
    "permission" IN (
      'writeMatchData', 'correctEvents', 'tournamentSettings', 'teams',
      'restructure', 'deleteTournament', 'manageMembers', 'leadMatches'
    )
  );

INSERT INTO "public"."role_permissions" ("role", "permission") VALUES
  ('co-admin', 'leadMatches')
ON CONFLICT ("role", "permission") DO NOTHING;


-- ============================================================================================
-- 9. Realtime-Publikation (C-PUB, R19)
-- ============================================================================================
--
-- Idempotenter DO-Block: fuegt match_events, matches, teams, monitor_heartbeats hinzu, NUR falls
-- fehlend. Live sind laut scripts/db-drift-check.sh (REALTIME_PUBLICATION_TABLES, Abschnitt 4d)
-- bereits genau diese vier Tabellen in supabase_realtime -- dieser Block ist dort ein No-op.
-- scripts/local-db-apply.sh setzt dieselben vier Tabellen fuer die lokale Testumgebung
-- (unveraendert, belegt per grep unten). match_event_authors ist bewusst NICHT enthalten (R17).

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['match_events', 'matches', 'teams', 'monitor_heartbeats']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END
$$;
