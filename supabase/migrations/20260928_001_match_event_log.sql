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
--
-- Abschluss-Fixrunde (final-review-B.md, M1): SET LOCAL lock_timeout am Anfang -- `apply_migration`
-- (Supabase MCP) spielt die gesamte Migration als EINE Transaktion ein, dort begrenzt das den
-- ACCESS-EXCLUSIVE-Lock auf match_events (ADD COLUMN seq ... IDENTITY, Abschnitt 2 unten) auf
-- maximal 5s Wartezeit gegen konkurrierende Leser/Schreiber, statt unbegrenzt zu blockieren.
-- Live sind es 0 Zeilen in match_events, das Risiko ist gering, die Sperrzeit trotzdem als
-- Sicherheitsnetz. In den Wegwerf-Container-Harnesses (rohes `psql -f`, keine explizite BEGIN/
-- COMMIT-Klammer um die ganze Datei) hat SET LOCAL ausserhalb eines Transaktionsblocks keine
-- Wirkung ueber die eigene implizite Transaktion hinaus (Postgres gibt dafuer eine WARNING aus,
-- keinen Fehler) -- harmlos, bricht das Einspielen nicht (siehe Testlauf im Report).

SET LOCAL lock_timeout = '5s';


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

-- Ruling S13 (B3b-Fixrunde 1, Migration noch nicht live -> hier direkt geaendert): 1-5, weil die
-- Verlaengerung Abschnitt sections+1 ist (B-U2) -- bei vier Abschnitten also 5.
ALTER TABLE "public"."match_events"
  DROP CONSTRAINT IF EXISTS "match_events_section_check";
ALTER TABLE "public"."match_events"
  ADD CONSTRAINT "match_events_section_check" CHECK ("section" IS NULL OR "section" BETWEEN 1 AND 5);

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
-- 4. Unveraenderlichkeit + Direktweg abdichten (R13, Ruling G1; neu gefasst in Fixrunde 1,
--    Ruling G2, nach Review-Funden C1/I1/I2)
-- ============================================================================================
--
-- Fixrunde 1 (task-B2-review.md, Ruling G2): die urspruengliche Fassung (Ruling G1) prüfte beim
-- UPDATE nur OLD.event_format -- eine Alt-Zeile (event_format IS NULL) liess sich per UPDATE zu
-- einer Engine-Zeile umschreiben (C1, R13 verletzt: leadMatches/append_match_events umgehbar),
-- und ein Client durfte beim INSERT einer Alt-Zeile beliebige Werte in die neuen Engine-Spalten
-- schreiben, u.a. target_event_id mit FK ON DELETE RESTRICT -- ein fremdes Turnier wurde dadurch
-- unloeschbar (I1). Die pg_trigger_depth()-Ausnahme fuer UPDATE war ausserdem gleichzeitig zu
-- streng (merge_user_data, das owner_id auf oberster Ebene setzt, scheiterte, I2) und zu locker
-- (jedes verschachtelte UPDATE, auch ON DELETE SET NULL fuer team_id/player_id, nutzte dieselbe
-- Ausnahme und liess Engine-Zeilen rueckwirkend veraendern).
--
-- Ruling G2 (Controller) -- vier Regeln:
--   (a) INSERT, current_user IN ('authenticated','anon'): NUR erlaubt, wenn NEW.type EIN alter
--       (legacy) Typ ist UND ALLE acht Engine-Spalten (event_format, target_event_id, base_seq,
--       review_state, clock_ms, section, client_time, control_epoch) NULL sind. Jede Abweichung
--       (neuer Typ, event_format gesetzt, oder auch nur EINE Engine-Spalte an einer sonst alten
--       Zeile gesetzt -- der I1-Fund) wird abgelehnt. Fuer current_user AUSSERHALB
--       authenticated/anon (SECURITY-DEFINER-Aufrufer, die kuenftige RPC) gilt keine Einschraenkung.
--   (b) UPDATE einer ALTEN Zeile (OLD.event_format IS NULL), current_user IN
--       ('authenticated','anon'): NEW.type muss weiterhin ein legacy Typ sein UND alle acht
--       Engine-Spalten muessen UNVERAENDERT bleiben (IS NOT DISTINCT FROM OLD) -- das schliesst
--       den C1-Umbauweg (Alt-Zeile -> Engine-Zeile per UPDATE). Fuer Nicht-Client-Rollen (z.B.
--       merge_user_data auf einer Alt-Zeile) gilt keine Einschraenkung -- unveraendert wie vor B2.
--   (c) UPDATE einer ENGINE-Zeile (OLD.event_format IS NOT NULL): `version` ist IMMER
--       ausgenommen (increment_match_event_version laeuft unabhaengig von der Rolle vor diesem
--       Guard). `owner_id`/`is_public` sind NUR fuer Nicht-Client-Rollen ausgenommen
--       (merge_user_data, cascade_tournament_visibility -- beide SECURITY DEFINER, current_user
--       NICHT authenticated/anon -- verschaerft in Fixrunde 2, Ruling G5, nach MR1: ohne diese
--       Einschraenkung konnte ein Client owner_id/is_public einer Engine-Zeile direkt aendern,
--       z.B. is_public=true auf einer einzelnen Zeile eines privaten Turniers setzen). Fuer JEDE
--       Rolle duerfen ZUSAETZLICH team_id/player_id auf NULL gesetzt werden, aber NUR wenn
--       pg_trigger_depth() > 1 gilt (die ON-DELETE-SET-NULL-Fremdschluessel-Trigger beim Loeschen
--       eines Teams/Spielers -- Baseline :1469/:1473 -- laufen selbst als Trigger, das UPDATE auf
--       match_events darin hat deshalb Tiefe > 1, siehe Harness-Probe) -- das bleibt ein reiner
--       Client-Vorgang (Team-/Spieler-Loeschung ist kein SECURITY-DEFINER-Aufruf), deshalb kein
--       current_user-Zweig hier. Jede andere Spaltenaenderung wird abgelehnt.
--   (d) DELETE einer Engine-Zeile: unveraendert -- nur erlaubt, wenn pg_trigger_depth() > 1 (die
--       Turnier-Loeschungs-Kaskade, siehe Herleitung unten). Gilt fuer JEDE Rolle, wie zuvor.
--
-- Ruling G5 (Fixrunde 2, MR1 aus task-B2-review.md Re-Review 1): (c) verschaerft wie oben --
-- owner_id/is_public duerfen nur noch von Nicht-Client-Rollen geaendert werden. Vorher liess G2c
-- ALLE Rollen owner_id/is_public aendern (Begruendung war die Kaskade/merge_user_data, beide
-- SECURITY DEFINER) -- ein Collaborator konnte dieselbe Freiheit direkt per UPDATE nutzen und
-- is_public=true auf einer einzelnen Engine-Zeile setzen, unabhaengig von der eigentlichen
-- Sichtbarkeits-Kaskade des Turniers (anon liest sie danach ueber match_events_select_v3).
--
-- Wechselwirkung mit vorhandenen Triggern auf match_events (geprueft, alle BEFORE, alle bleiben
-- unveraendert und laufen unabhaengig vom neuen Guard weiter):
--   - match_events_sync_owner (BEFORE INSERT, sync_owner_from_match): setzt owner_id/is_public
--     vom Elternspiel ab -- betrifft eine andere Spalte, keine Ueberschneidung.
--   - match_event_version_trigger (BEFORE UPDATE, increment_match_event_version): erhoeht
--     version -- ausdruecklich in der (c)-Ausnahme erlaubt (siehe oben). Trigger-Reihenfolge
--     bleibt alphabetisch nach Name ("match_event_version_trigger" <
--     "match_events_guard_engine_rows" < "match_events_protect_*"); der Guard sieht NEW.version
--     deshalb bereits erhoeht, ist aber unerheblich, weil version explizit ausgenommen ist.
--   - match_events_protect_owner_id (BEFORE UPDATE, protect_owner_id): haelt owner_id fest,
--     kein RAISE -- keine Ueberschneidung, owner_id ist ohnehin in (c) erlaubt.
--   - match_events_protect_match_id (BEFORE UPDATE, protect_parent_keys('match_id')): wirft bei
--     App-seitigem Umhaengen von match_id -- keine Ueberschneidung (andere Spalte, match_id ist in
--     (c) NICHT erlaubt und wuerde ohnehin schon von protect_parent_keys blockiert).
--   - matches_protect_events_before_delete (20260925_002) sitzt auf `matches`, nicht auf
--     match_events -- betrifft diesen Guard nicht direkt, ist aber der Grund, warum die
--     Kaskaden-Ausnahme (d) dasselbe Muster (pg_trigger_depth() > 1) braucht: Loeschen eines
--     Spiels MIT Ereignissen ist durch protect_matches_with_events bereits blockiert; die einzige
--     verbleibende Route zu einem DELETE auf match_events mit event_format IS NOT NULL ist die
--     Turnier-Kaskade (tournaments -> matches -> match_events, ON DELETE CASCADE, Baseline Zeile
--     ~1461) -- dort ist pg_trigger_depth() beim Erreichen von match_events 2 (die
--     matches-Kaskade selbst ist bereits Tiefe 1 innerhalb der tournaments-Loeschung), also > 1,
--     die Ausnahme greift. Siehe Kaskaden-Kommentar in 20260925_002 fuer die vollstaendige
--     Herleitung von pg_trigger_depth().
--
-- Bewusste Grenze (Review M7, akzeptiert): der Guard unterscheidet nur current_user IN
-- ('authenticated','anon') (Client-Rollen, Ruling G1) von allem anderen. Jede andere
-- Login-Rolle mit INSERT/UPDATE-Recht auf match_events (heute nur postgres/service_role, die
-- Migrationsrolle) umgeht die Sperre -- akzeptiert, weil kein App-Pfad diese Rollen erreicht.

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
  is_client boolean := current_user IN ('authenticated', 'anon');
  old_cmp jsonb;
  new_cmp jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Ruling G2(a).
    IF is_client THEN
      IF NOT (NEW.type = ANY (legacy_types))
         OR NEW.event_format IS NOT NULL
         OR NEW.target_event_id IS NOT NULL
         OR NEW.base_seq IS NOT NULL
         OR NEW.review_state IS NOT NULL
         OR NEW.clock_ms IS NOT NULL
         OR NEW.section IS NOT NULL
         OR NEW.client_time IS NOT NULL
         OR NEW.control_epoch IS NOT NULL
      THEN
        RAISE EXCEPTION
          'Nicht erlaubt: neue Ereignis-Zeilen (event_format/Engine-Spalten gesetzt oder neuer Typ %) duerfen nur ueber append_match_events geschrieben werden.',
          NEW.type
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.event_format IS NOT NULL THEN
      -- Ruling G2(c), verschaerft in Fixrunde 2 durch Ruling G5 (MR1, task-B2-review.md
      -- Re-Review 1): Engine-Zeile. `version` ist IMMER ausgenommen (increment_match_event_
      -- version laeuft vor diesem Guard, unabhaengig von der Rolle -- siehe Abschnitt-
      -- Kommentar oben). `owner_id`/`is_public` sind NUR fuer Nicht-Client-Rollen ausgenommen
      -- (current_user NICHT authenticated/anon) -- die beiden legitimen Schreiber
      -- (merge_user_data, cascade_tournament_visibility) sind SECURITY DEFINER. Ohne diese
      -- Verschaerfung konnte ein Collaborator is_public einer EINZELNEN Engine-Zeile eines
      -- privaten Turniers auf true setzen (MR1: reproduziert, anon liest sie danach ueber
      -- match_events_select_v3) -- die Klasse gab es zwar vorher schon bei Alt-Zeilen, aber
      -- R13 soll fuer Engine-Zeilen keine neue Angriffsflaeche eroeffnen. team_id/player_id ->
      -- NULL bleiben unveraendert nur bei pg_trigger_depth() > 1 (FK-Kaskade) erlaubt, fuer
      -- JEDE Rolle (Teamloeschung ist ein Client-Vorgang, kein SECURITY-DEFINER-Aufruf).
      -- Alles andere muss unveraendert bleiben.
      old_cmp := to_jsonb(OLD) - ARRAY['version'];
      new_cmp := to_jsonb(NEW) - ARRAY['version'];
      IF NOT is_client THEN
        old_cmp := old_cmp - ARRAY['owner_id', 'is_public'];
        new_cmp := new_cmp - ARRAY['owner_id', 'is_public'];
      END IF;
      IF pg_trigger_depth() > 1 THEN
        IF NEW.team_id IS NULL THEN
          old_cmp := old_cmp - 'team_id';
          new_cmp := new_cmp - 'team_id';
        END IF;
        IF NEW.player_id IS NULL THEN
          old_cmp := old_cmp - 'player_id';
          new_cmp := new_cmp - 'player_id';
        END IF;
      END IF;
      IF old_cmp IS DISTINCT FROM new_cmp THEN
        RAISE EXCEPTION
          'Nicht erlaubt: Ereignis-Zeilen der neuen Rechenfunktion (event_format gesetzt) sind unveraenderlich (ausser version immer, owner_id/is_public nur fuer Nicht-Client-Rollen, sowie team_id/player_id bei Team-/Turnier-Loeschung).'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN NEW;
    END IF;

    -- Ruling G2(b): Alte Zeile (OLD.event_format IS NULL), Client-Rolle -- Typ muss legacy
    -- bleiben, keine Engine-Spalte darf sich aendern (schliesst C1: Alt-Zeile -> Engine-Zeile
    -- per UPDATE).
    IF is_client THEN
      IF NOT (NEW.type = ANY (legacy_types))
         OR NEW.event_format IS NOT NULL
         OR NEW.target_event_id IS DISTINCT FROM OLD.target_event_id
         OR NEW.base_seq IS DISTINCT FROM OLD.base_seq
         OR NEW.review_state IS DISTINCT FROM OLD.review_state
         OR NEW.clock_ms IS DISTINCT FROM OLD.clock_ms
         OR NEW.section IS DISTINCT FROM OLD.section
         OR NEW.client_time IS DISTINCT FROM OLD.client_time
         OR NEW.control_epoch IS DISTINCT FROM OLD.control_epoch
      THEN
        RAISE EXCEPTION
          'Nicht erlaubt: eine bestehende Ereignis-Zeile darf per UPDATE nicht zu einer Ereignis-Zeile der neuen Rechenfunktion (event_format/Engine-Spalten) werden -- nur ueber append_match_events.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Ruling G2(d): unveraendert.
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
  'B2 (R13, Ruling G1, neu gefasst in Fixrunde 1 als Ruling G2 nach Review-Funden C1/I1/I2,
   verschaerft in Fixrunde 2 als Ruling G5 nach Review-Fund MR1): dichtet den Direktweg fuer die
   neue Rechenfunktion ab. INSERT: Client-Rollen (authenticated/anon) duerfen nur legacy Typen MIT
   durchgaengig NULL Engine-Spalten schreiben (G2a). UPDATE einer bestehenden Alt-Zeile:
   Client-Rollen duerfen weder den Typ auf einen neuen Typ noch eine Engine-Spalte aendern (G2b,
   schliesst C1). UPDATE einer Engine-Zeile: version ist IMMER ausgenommen, owner_id/is_public NUR
   fuer Nicht-Client-Rollen (G5, loest MR1 -- vorher durfte JEDE Rolle sie aendern), zusaetzlich
   team_id/player_id -> NULL fuer JEDE Rolle nur bei pg_trigger_depth() > 1 -- FK-Kaskade beim
   Team-/Spieler-Loeschen (G2c, loest I2). DELETE einer Engine-Zeile nur bei
   pg_trigger_depth() > 1 -- Turnier-Loeschungs-Kaskade (G2d, unveraendert). Bewusste Grenze
   (Review M7): current_user unterscheidet nur authenticated/anon von allem anderen, keine
   feinere Rollenprüfung. Alte Zeilen (event_format IS NULL) und alte Typen bleiben ansonsten
   unberuehrt bis D3.';

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

-- Abschluss-Fixrunde (final-review-B.md, I1): ci_schema_reader (die nur-lesende Rolle, ueber die
-- scripts/db-drift-check.sh das Live-Schema per pg_dump --schema-only zieht) braucht einen
-- Tabellen-GRANT, sonst scheitert der Dump nach dem Live-Apply mit "permission denied for table
-- match_event_authors" -- selbst OHNE dass irgendjemand Zeilendaten lesen kann: es gibt fuer
-- diese Rolle keine SELECT-Policy (anders als match_transitions/app_config unten, die absichtlich
-- oeffentlich lesbar sind), RLS liefert also weiterhin 0 Zeilen. Muster
-- 20260924_002_central_role_permissions.sql:231 (role_permissions_select_ci_schema_reader hat
-- dort zusaetzlich eine eigene Policy, weil der Drift-Check DORT den Zeileninhalt vergleicht --
-- match_event_authors braucht das nicht, nur den Schema-Dump).
GRANT SELECT ON "public"."match_event_authors" TO "ci_schema_reader";


-- ============================================================================================
-- 6. match_transitions -- Seed exakt aus src/core/match/matchTransitions.json (Ruling P1)
-- ============================================================================================

-- M5 (task-B2-review.md, Fixrunde 1): billige Absicherung zusaetzlich zum Gleichlauf-Check --
-- from_status/event_type/to_status gegen dieselben Wertelisten wie MatchStatusSchema
-- (src/core/match/types.ts) bzw. match_events_type_check oben. to_status erlaubt zusaetzlich die
-- beiden Sentinel-Werte '=' (Zustand bleibt) und '@endcheck' (automatische Spielende-Pruefung,
-- R5) aus matchTransitions.json.
CREATE TABLE IF NOT EXISTS "public"."match_transitions" (
  "from_status" text NOT NULL,
  "event_type" text NOT NULL,
  "actor" text NOT NULL,
  "to_status" text NOT NULL,
  CONSTRAINT "match_transitions_pkey" PRIMARY KEY ("from_status", "event_type"),
  CONSTRAINT "match_transitions_actor_check" CHECK ("actor" IN ('helper', 'leitung')),
  CONSTRAINT "match_transitions_from_status_check" CHECK (
    "from_status" IN (
      'scheduled', 'running', 'paused', 'section_break', 'decision_pending', 'shootout',
      'finished', 'skipped'
    )
  ),
  CONSTRAINT "match_transitions_to_status_check" CHECK (
    "to_status" IN (
      'scheduled', 'running', 'paused', 'section_break', 'decision_pending', 'shootout',
      'finished', 'skipped', '=', '@endcheck'
    )
  ),
  CONSTRAINT "match_transitions_event_type_check" CHECK (
    "event_type" IN (
      'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
      'TIME_PENALTY', 'TIME_PENALTY_END', 'SUBSTITUTION', 'TIMEOUT', 'STATUS_CHANGE',
      'RESULT_EDIT', 'NOTE', 'FOUL', 'HALFTIME',
      'MATCH_START', 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST',
      'MATCH_END', 'TIEBREAK_CHOICE', 'SHOOTOUT_KICK', 'SHOOTOUT_END', 'RETRACT', 'CORRECTION',
      'REOPEN', 'SKIP', 'UNSKIP', 'RESULT_ENTRY', 'REVIEW_ACCEPT', 'REVIEW_DISCARD'
    )
  )
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
