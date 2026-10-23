-- supabase/migrations/20261117_005_klaerungsliste.sql
-- A-35 Klärungsliste – Server (MVP-Bauplan § 20 „A-35“, Nachtrag GA5 v2.1 I-4): Einträge, die nicht still zählen dürfen,
-- legt der Server „zur Klärung“ ab, statt sie abzulehnen oder still anzuwenden; die Turnierleitung entscheidet mit
-- „Übernehmen“ (REVIEW_ACCEPT) oder „Verwerfen“ (REVIEW_DISCARD) – beides sind Einträge im Spielverlauf.
-- Szenarien: @FU-036, @FU-037, @FU-038, @FU-095, @FU-096 (Server-Teil: je Eintrag entscheiden), @FU-017, @FU-116 (Z. 2),
--   @HE-056, @HE-080; @FU-108 unberührt (Konflikt der Turnier-Synchronisation, nicht append_match_events);
--   @SA-009 nur vorbereitet (Grund BEFORE_RESET – den Weg legt der Versions-Kern A-33 an, den es noch nicht gibt).
--   Befund C-KLAERUNGSLISTE-OHNE-PAKET.
--
-- Inhalt:
--   1. Tabelle public.field_control_log: je Feld und Steuer-Epoche, wer gesteuert hat und seit wann (Trigger auf
--      field_control, Backfill aus dem heutigen Stand). Grundlage für „hatte dieses Gerät das Steuer, und wann hat es
--      es verloren“. Nur Server-Funktionen lesen; keine Client-Rechte.
--   2. Tabelle public.match_reviews: je Klärungseintrag (kind 'review') bzw. je nachträglich einsortiertem Eintrag
--      (kind 'notice', @FU-037 „1 Tor von Tom (Feld 2) nachträglich eingefügt“) Grund, Gerät, Konto, Angaben. Der Eintrag
--      selbst steht in match_events mit review_state 'pending' (zählt nie: jede Rechnung liest review_state IS NULL).
--      Lesen nur die Turnierleitung (leadMatches); schreiben nur append_match_events.
--   3. match_transitions: REVIEW_ACCEPT und REVIEW_DISCARD für die Turnierleitung aus jedem Zustand, Ziel '=' (exakt
--      src/core/match/matchTransitions.json). Die Entscheidung selbst ändert den Stand nicht.
--   4. public.match_apply_event (Fassung 20261110_005 + Schritt 3a): eine Kopie, die der Server beim Übernehmen anlegt
--      (gleicher Typ, targetId = Klärungseintrag, Akteur leitung), zählt auch im beendeten Gruppenspiel; im beendeten
--      K.-o.-Spiel und in einem nie angepfiffenen Spiel nicht (INVALID_TRANSITION KNOCKOUT_FINISHED / NOT_STARTED).
--      TS-Zwilling: src/core/match/handlers/reviewCopy.ts; Gleichlauf scripts/match-engine-parity.sh (Fixtures 71a–71e).
--   5. Hilfen im Schema match_engine (ohne EXECUTE für Client-Rollen): rights_change, review_store, review_repeat,
--      review_route, review_target_check, review_copy, revoked_intake.
--   6. public.append_match_events (Fassung 20261113_003 = 20261110_009 + closed_intake, plus NUR hinzugefügte Zeilen):
--      a. Recht verloren (I-4, @FU-017, @HE-056, @HE-080): wer im Turnier eingetragen hatte und jetzt entzogen, entfernt
--         oder zum Zuschauer gemacht ist, bekommt statt FORBIDDEN_ACTOR „review RIGHTS_REVOKED“ für alles, was das Gerät
--         bis zu seiner ersten Verbindung nach dem Entzug gemacht hat; danach nimmt der Server nichts mehr an
--         (FORBIDDEN_ACTOR RIGHTS_REVOKED; Regel F6, Tabelle revoked_device_contacts).
--      b. Steuer verloren (@FU-036, @FU-038): Einträge eines Geräts mit einer Steuer-Epoche, die es selbst gehalten hat,
--         die aber nicht mehr gilt -> „review CONTROL_LOST“. Ausnahme @FU-037: vor der Übernahme gemacht, Spielstand-,
--         Karten-, Straf-, Foul- oder Wechsel-Eintrag, kein gleichartiger Eintrag des neuen Halters für dasselbe Team und
--         keine Überschreibung seitdem -> zählt wie gesendet (accepted) mit Hinweis (kind 'notice'); lehnt die
--         Rechenfunktion ihn dann ab (Spiel inzwischen beendet, @FU-130), landet er mit AFTER_END in der Klärungsliste.
--      c. Nach dem Ende (@FU-116 Z. 2): ein Spielstand-, Karten-, Straf-, Foul- oder Wechsel-Eintrag, den die
--         Rechenfunktion mit MATCH_FINISHED ablehnt -> „review AFTER_END“.
--      d. Entscheiden: REVIEW_ACCEPT/REVIEW_DISCARD der Turnierleitung (ohne Feldsteuerung, wie das Beenden im Spielplan)
--         nur für einen offenen Klärungseintrag dieses Spiels (sonst UNKNOWN_TARGET NOT_IN_REVIEW / ALREADY_DECIDED);
--         Übernehmen nur für Spielstand-, Karten-, Straf-, Foul-, Wechsel-Einträge (sonst INVALID_PAYLOAD NOT_ACCEPTABLE)
--         und nur, wenn die Kopie gilt (sonst deren Ablehnung). Gespeichert: zuerst die Entscheidung, dann die Kopie.
--      e. Wiederholt ein Gerät einen schon zur Klärung gelegten Eintrag, bleibt es „review“ (nie duplicate = angenommen).
--   7. RPC public.list_match_reviews(uuid): Klärungsliste eines Turniers für die Turnierleitung (B-50), sonst [].
--   8. match_engine.closed_intake (Fassung 20261113_003, nur hinzugefügte Zeilen): die Wiederholung eines schon zur Klärung
--      gelegten Eintrags nach dem Abschluss bleibt review (Review m1, kein Geistertor auf dem Gerät).
--
-- Antwort an das Gerät: {id, status 'review', code <Grund>} – die App nimmt den Eintrag aus dem Ausgang und zeigt
-- „wird geprüft“ (outboxResolution.ts kennt 'review' schon). Ein Klärungseintrag ändert weder Stand noch Zwischenspeicher.
--
-- Voraussetzung: 20261113_003 (append_match_events mit closed_intake auf der Fassung 20261110_009, tournament_is_closed,
--   actor_name), 20261110_005 (match_apply_event), 20261110_003 (field_control), 20261110_008 (tournament_join_requests),
--   20260924_002 (ci_schema_reader). Unabhängig von 20261117_104 (B-14); Reihenfolge im Fenster F4: B-14, dann diese Datei.
--   Idempotent (IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO NOTHING, DROP … IF EXISTS + CREATE).
--
-- Bestandsdaten: keine Änderung an vorhandenen Zeilen. field_control_log bekommt je vorhandener field_control-Zeile die
--   aktuelle Epoche (Backfill); match_reviews startet leer. Vorhandene match_events mit review_state <> NULL: live 0
--   (Zählung in der Freigabe-Unterlage).
--
-- RÜCKWEG: eigene Datei (Anhang B von A-35-sql-freigabe.md, erzeugt mit `bash scripts/klaerungsliste-check.sh
--   --print-rueckweg`), EIN Block. append_match_events und closed_intake kommen wörtlich aus 20261113_003,
--   match_apply_event wörtlich aus 20261110_005 zurück. Hält an, sobald ein Klärungseintrag oder eine Entscheidung gespeichert ist.
--   Belegt in scripts/klaerungsliste-check.sh (Kategorie X: Schema danach = vorher).
--
-- Produktion: nur im DB-Fenster F4 (Di 17.11.) durch den Controller nach Daniels Freigabe (A-35-sql-freigabe.md), nach
-- 20261110_005 … _009, 20261113_101, 20261113_003 und 20261117_104. Dieser Branch spielt nichts ein. Typen-PR nötig.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Änderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_append text;
  v_apply text;
BEGIN
  IF to_regclass('public.field_control') IS NULL OR to_regclass('public.match_event_authors') IS NULL
     OR to_regclass('public.late_entries') IS NULL OR to_regclass('public.tournament_join_requests') IS NULL
     OR to_regprocedure('public.tournament_is_closed(uuid)') IS NULL
     OR to_regprocedure('match_engine.closed_intake(uuid,uuid,jsonb,uuid,uuid)') IS NULL
     OR to_regprocedure('match_engine.actor_name(uuid,uuid)') IS NULL
     OR to_regprocedure('match_engine.envelope(jsonb,text,text)') IS NULL
     OR to_regprocedure('match_engine.dedupe_key(jsonb)') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261117_005_klaerungsliste: Voraussetzungen fehlen – zuerst 20261110_003 … 20261113_003 einspielen';
  END IF;
  -- append_match_events: nur die Fassung aus 20261113_003 (closed_intake auf 20261110_009 mit v_end_by_lead) oder diese
  -- Datei ersetzen, nie still eine andere Fassung (sonst gingen „Spiel beenden“ oder die Abschluss-Sperre verloren).
  SELECT prosrc INTO v_append FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');
  IF v_append IS NULL
     OR NOT (    position('match_engine.closed_intake(' IN v_append) > 0
             AND position('IF NOT v_end_by_lead' IN v_append) > 0
             AND position('INSERT INTO public.field_control' IN v_append) > 0) THEN
    RAISE EXCEPTION '20261117_005_klaerungsliste: append_match_events hat eine unbekannte Fassung (erwartet 20261113_003) – erst klären';
  END IF;
  -- closed_intake: Fassung 20261113_003 (late_entries) oder diese Datei.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.closed_intake(uuid,uuid,jsonb,uuid,uuid)')
                  AND position('INSERT INTO public.late_entries' IN prosrc) > 0) THEN
    RAISE EXCEPTION '20261117_005_klaerungsliste: closed_intake hat eine unbekannte Fassung (erwartet 20261113_003) – erst klären';
  END IF;
  -- match_apply_event: Fassung 20261110_005 (A-25n '@reopen') oder diese Datei.
  SELECT prosrc INTO v_apply FROM pg_proc WHERE oid = to_regprocedure('public.match_apply_event(jsonb,jsonb,jsonb,jsonb)');
  IF v_apply IS NULL OR position('''@reopen''' IN v_apply) = 0 THEN
    RAISE EXCEPTION '20261117_005_klaerungsliste: match_apply_event hat eine unbekannte Fassung (erwartet 20261110_005) – erst klären';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. field_control_log: wer welches Feld in welcher Epoche gesteuert hat (seit wann)
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_control_log (
  tournament_id    uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  field            integer     NOT NULL,
  epoch            integer     NOT NULL CHECK (epoch >= 0),
  holder_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  holder_device_id uuid,
  claimed_at       timestamptz NOT NULL,
  PRIMARY KEY (tournament_id, field, epoch)
);
COMMENT ON TABLE public.field_control_log IS
  'A-35 (@FU-036, @FU-037, @FU-038): je Feld und Steuer-Epoche der Halter (NULL = frei) und der Beginn. Schreibt nur der Trigger field_control_log_write; lesen nur Server-Funktionen (append_match_events über match_engine.review_route).';
ALTER TABLE public.field_control_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.field_control_log FROM PUBLIC, anon, authenticated, ci_schema_reader;
GRANT SELECT ON TABLE public.field_control_log TO ci_schema_reader;   -- pg_dump des Drift-Checks; RLS an, keine Policy

CREATE OR REPLACE FUNCTION public.field_control_log_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.epoch IS DISTINCT FROM OLD.epoch THEN
    INSERT INTO public.field_control_log (tournament_id, field, epoch, holder_user_id, holder_device_id, claimed_at)
    VALUES (NEW.tournament_id, NEW.field, NEW.epoch, NEW.holder_user_id, NEW.holder_device_id, NEW.claimed_at)
    ON CONFLICT (tournament_id, field, epoch) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.field_control_log_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS field_control_log_write ON public.field_control;
CREATE TRIGGER field_control_log_write AFTER INSERT OR UPDATE ON public.field_control
  FOR EACH ROW EXECUTE FUNCTION public.field_control_log_write();

-- Bestand: die heute gültige Epoche je Feld (frühere Epochen sind nicht mehr rekonstruierbar).
INSERT INTO public.field_control_log (tournament_id, field, epoch, holder_user_id, holder_device_id, claimed_at)
SELECT fc.tournament_id, fc.field, fc.epoch, fc.holder_user_id, fc.holder_device_id, fc.claimed_at
  FROM public.field_control fc
ON CONFLICT (tournament_id, field, epoch) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------
-- 1b. revoked_device_contacts: erster Kontakt eines Geräts nach dem Entzug (F6, @HE-080, @HE-056)
-- ---------------------------------------------------------------------------------------------------------------
-- Nachblick N1: je Turnier und KONTO (nicht je Geräte-ID – die schickt der Client selbst und könnte sie wechseln). Ein
-- QR-Gerät ist ein eigenes anonymes Konto, verlorenes Handy und Ersatzhandy bleiben getrennt (@HE-080).
CREATE TABLE IF NOT EXISTS public.revoked_device_contacts (
  tournament_id    uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_device_id  uuid,                   -- Geräte-ID der ersten Verbindung (nur zur Anzeige, nie Schlüssel)
  revoked_since    timestamptz,            -- declined_at beim Entziehen, sonst NULL (zum Zuschauer gemacht, entfernt)
  first_contact_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);
COMMENT ON TABLE public.revoked_device_contacts IS
  'A-35 F6 (Daniel 23.10., @HE-080, @HE-056): erster Aufruf eines Kontos (QR-Gerät = eigenes anonymes Konto) nach dem Entzug seines Rechts. Einträge mit Gerätezeit bis dahin gehen zur Klärung (RIGHTS_REVOKED), spätere lehnt append_match_events ab. Nur Server-Funktionen (revoked_intake); keine Client-Rechte.';
ALTER TABLE public.revoked_device_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.revoked_device_contacts FROM PUBLIC, anon, authenticated, ci_schema_reader;
GRANT SELECT ON TABLE public.revoked_device_contacts TO ci_schema_reader;   -- pg_dump des Drift-Checks; RLS an, keine Policy

-- ---------------------------------------------------------------------------------------------------------------
-- 2. match_reviews: Klärungseinträge und Hinweise
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_reviews (
  event_id      uuid        PRIMARY KEY REFERENCES public.match_events(id) ON DELETE CASCADE,
  tournament_id uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id      uuid        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  field         integer,
  kind          text        NOT NULL CHECK (kind IN ('review', 'notice')),
  reason        text        NOT NULL CHECK (reason IN ('CONTROL_LOST', 'RIGHTS_REVOKED', 'AFTER_END', 'BEFORE_RESET')),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id     uuid,
  detail        jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object'),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_reviews_tournament_idx ON public.match_reviews (tournament_id, created_at);
CREATE INDEX IF NOT EXISTS match_reviews_match_idx ON public.match_reviews (match_id);
COMMENT ON TABLE public.match_reviews IS
  'A-35 (@FU-038, @FU-017, @HE-056, @HE-080, @FU-116): Klärungsliste. kind review = Eintrag liegt in match_events mit review_state pending und zählt erst nach „Übernehmen“ (REVIEW_ACCEPT + Kopie); kind notice = nachträglich eingefügt (@FU-037). Offen = kein REVIEW_ACCEPT/REVIEW_DISCARD mit target_event_id = event_id. Lesen nur Turnierleitung (leadMatches), schreiben nur append_match_events.';
ALTER TABLE public.match_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_reviews FROM PUBLIC, anon, authenticated, ci_schema_reader;
GRANT SELECT ON TABLE public.match_reviews TO authenticated;
GRANT SELECT ON TABLE public.match_reviews TO ci_schema_reader;      -- pg_dump des Drift-Checks; Daten sieht sie keine
DROP POLICY IF EXISTS match_reviews_select ON public.match_reviews;
CREATE POLICY match_reviews_select ON public.match_reviews FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'leadMatches'));

-- ---------------------------------------------------------------------------------------------------------------
-- 3. match_transitions: Entscheidungen der Turnierleitung (exakt src/core/match/matchTransitions.json)
-- ---------------------------------------------------------------------------------------------------------------
INSERT INTO "public"."match_transitions" ("from_status", "event_type", "actor", "to_status") VALUES
  ('scheduled', 'REVIEW_ACCEPT', 'leitung', '='),
  ('scheduled', 'REVIEW_DISCARD', 'leitung', '='),
  ('running', 'REVIEW_ACCEPT', 'leitung', '='),
  ('running', 'REVIEW_DISCARD', 'leitung', '='),
  ('paused', 'REVIEW_ACCEPT', 'leitung', '='),
  ('paused', 'REVIEW_DISCARD', 'leitung', '='),
  ('section_break', 'REVIEW_ACCEPT', 'leitung', '='),
  ('section_break', 'REVIEW_DISCARD', 'leitung', '='),
  ('decision_pending', 'REVIEW_ACCEPT', 'leitung', '='),
  ('decision_pending', 'REVIEW_DISCARD', 'leitung', '='),
  ('shootout', 'REVIEW_ACCEPT', 'leitung', '='),
  ('shootout', 'REVIEW_DISCARD', 'leitung', '='),
  ('finished', 'REVIEW_ACCEPT', 'leitung', '='),
  ('finished', 'REVIEW_DISCARD', 'leitung', '='),
  ('skipped', 'REVIEW_ACCEPT', 'leitung', '='),
  ('skipped', 'REVIEW_DISCARD', 'leitung', '=')
ON CONFLICT ("from_status", "event_type") DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. match_apply_event: Kopie eines übernommenen Klärungseintrags in ein beendetes Spiel (Fassung 20261110_005 + 3a)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_apply_event(state jsonb, event jsonb, ctx jsonb, transitions jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := event ->> 'type';
  v_status text := state ->> 'status';
  v_row jsonb;
  v_effect jsonb;
  v_state jsonb;
BEGIN
  -- 1. Payload (zod) -> INVALID_PAYLOAD.
  IF NOT match_engine.payload_valid(event, ctx) THEN
    RETURN match_engine.reject('INVALID_PAYLOAD');
  END IF;

  -- 2. R9/K8/B-U7: weiteres Spielende ist noop.
  IF v_type = 'MATCH_END' AND v_status IN ('finished', 'section_break', 'decision_pending', 'shootout') THEN
    RETURN jsonb_build_object('status', 'noop', 'state', state);
  END IF;

  -- 3a. A-35 (@FU-095, @FU-116): Kopie eines uebernommenen Klaerungseintrags (targetId gesetzt, Akteur leitung -- schreibt
  --     nur append_match_events, der Umschlag laesst targetId nur bei RETRACT/AMEND/REVIEW_* zu) zaehlt auch im beendeten
  --     Gruppenspiel; im beendeten K.-o.-Spiel oder ohne Anpfiff (keine Regeln) nicht. TS: handlers/reviewCopy.ts.
  IF v_status = 'finished'
     AND v_type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY', 'FOUL', 'SUBSTITUTION')
     AND match_engine.truthy(event -> 'targetId') AND coalesce(event -> 'actor' = '"leitung"'::jsonb, false) THEN
    IF jsonb_typeof(state -> 'rules') IS DISTINCT FROM 'object' THEN
      RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "NOT_STARTED"}'::jsonb);
    END IF;
    IF coalesce((state -> 'rules' ->> 'knockout')::boolean, false) THEN
      RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "KNOCKOUT_FINISHED"}'::jsonb);
    END IF;
    v_row := jsonb_build_object('from', 'finished', 'type', v_type, 'actor', 'leitung', 'to', '=');
  END IF;

  -- 3. Uebergangszeile (erste passende, wie Array.find).
  IF v_row IS NULL THEN  -- A-35 (3a)
  SELECT r INTO v_row
    FROM jsonb_array_elements(coalesce(transitions, '[]'::jsonb)) WITH ORDINALITY AS x(r, ord)
   WHERE r ->> 'from' = v_status AND r ->> 'type' = v_type
   ORDER BY ord
   LIMIT 1;
  END IF;  -- A-35 (3a)
  IF v_row IS NULL THEN
    RETURN match_engine.reject(CASE WHEN v_status = 'finished' THEN 'MATCH_FINISHED' ELSE 'INVALID_TRANSITION' END);
  END IF;

  -- 4. Akteur (R7): helper-Zeile erlaubt Helfer UND Turnierleitung.
  IF NOT (v_row ->> 'actor' = 'helper' OR coalesce(event -> 'actor' = '"leitung"'::jsonb, false)) THEN
    RETURN match_engine.reject('FORBIDDEN_ACTOR');
  END IF;

  -- 5. Typspezifische Wirkung, dann `to` (A-25n: '@reopen' = Zielzustand aus der Wirkung).
  v_effect := match_engine.apply_effect(state, event, ctx);
  IF v_effect ->> 'status' = 'rejected' THEN
    RETURN v_effect;
  END IF;
  v_state := v_effect -> 'state';
  IF v_row ->> 'to' = '@endcheck' THEN
    v_state := match_engine.endcheck(v_state, event, ctx);
  ELSIF v_row ->> 'to' NOT IN ('=', '@reopen') THEN
    -- A-25n: bei '@reopen' hat die Wirkung (apply_effect REOPEN) den Zielzustand schon gesetzt (applyEvent.ts).
    v_state := v_state || jsonb_build_object('status', v_row ->> 'to');
  END IF;

  -- K1: decidedBy zentral ableiten; Ereignis als angenommen fuehren (kanonisch, K3).
  v_state := v_state || jsonb_build_object(
    'decidedBy', match_engine.decided_by(v_state),
    'accepted', (v_state -> 'accepted') || jsonb_build_object(event ->> 'id', match_engine.canonical(event)));

  -- C0a (V1): ein angenommenes Zielereignis bringt seine Angaben aus der Payload mit.
  IF match_engine.detail_fields(v_type) IS NOT NULL THEN
    v_state := v_state || jsonb_build_object('details', coalesce(v_state -> 'details', '{}'::jsonb)
      || jsonb_build_object(event ->> 'id', match_engine.details_from_payload(v_type, event -> 'payload')));
  END IF;
  RETURN jsonb_build_object('status', 'accepted', 'state', v_state);
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Hilfen (nur aus SECURITY-DEFINER-Funktionen erreichbar)
-- ---------------------------------------------------------------------------------------------------------------

-- Eintragsarten, die zählen können, ohne Uhr und Spielstatus zu verändern (Spielstand, Karten, Strafen, Fouls, Wechsel):
-- nur sie sortiert der Server von selbst ein (@FU-037) und nur sie lassen sich übernehmen (@FU-095).
-- Gleiche Liste in TS: src/core/match/handlers/reviewCopy.ts REVIEW_COPY_TYPES.

-- Recht verloren (I-4, @FU-017, @HE-056, @HE-080): wer im Turnier eingetragen hat bzw. per QR zugelassen war und heute
-- kein Schreibrecht mehr hat. 'revoked' (Zugang entzogen, mit Zeitpunkt), 'watch_only' (zum Zuschauer gemacht bzw. Rolle
-- ohne Schreibrecht), 'removed' (aus dem Turnier entfernt, keine Mitgliedszeile mehr). NULL = nie Schreiber gewesen
-- (z. B. Trainer, fremdes Konto) -> wie bisher FORBIDDEN_ACTOR. Aufrufer prüft vorher, dass das Schreibrecht fehlt.
CREATE OR REPLACE FUNCTION match_engine.rights_change(p_tournament_id uuid, p_uid uuid) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  WITH m AS (
    SELECT c.role, c.declined_at, c.accepted_at
      FROM public.tournament_collaborators c
     WHERE c.tournament_id = p_tournament_id AND c.user_id = p_uid
     ORDER BY c.accepted_at DESC NULLS LAST, c.created_at DESC NULLS LAST
     LIMIT 1
  ), w AS (
    SELECT EXISTS (SELECT 1 FROM public.match_event_authors a
                    WHERE a.tournament_id = p_tournament_id AND a.user_id = p_uid)
        OR EXISTS (SELECT 1 FROM public.tournament_join_requests r
                    WHERE r.tournament_id = p_tournament_id AND r.device_user_id = p_uid AND r.status = 'accepted') AS wrote
  )
  SELECT CASE
           WHEN p_uid IS NULL OR p_uid = (SELECT t.owner_id FROM public.tournaments t WHERE t.id = p_tournament_id) THEN NULL
           WHEN EXISTS (SELECT 1 FROM m WHERE m.declined_at IS NOT NULL AND (m.accepted_at IS NOT NULL OR (SELECT w.wrote FROM w)))
             THEN jsonb_build_object('change', 'revoked',
                                     'since', (SELECT floor(extract(epoch FROM m.declined_at) * 1000)::bigint FROM m))
           WHEN NOT (SELECT w.wrote FROM w) THEN NULL
           WHEN EXISTS (SELECT 1 FROM m) THEN jsonb_build_object('change', 'watch_only', 'since', NULL)
           ELSE jsonb_build_object('change', 'removed', 'since', NULL)
         END;
$$;

-- Eintrag zur Klärung ablegen: in match_events mit review_state 'pending' (zählt nie), Urheber in match_event_authors,
-- Grund in match_reviews. Gerätezeit = gesendetes `at` (höchstens jetzt), nicht die geklemmte Serverzeit. Ein Ziel
-- (targetId), das es in diesem Spiel nicht gibt, steht nur im Detail (Fremdschlüssel). Höchstens 100 Klärungseinträge je
-- Spiel UND Konto (Review m2, Nachblick N1: nicht je Geräte-ID, die der Client selbst schickt) – danach FORBIDDEN_ACTOR
-- REVIEW_LIMIT. Ein entzogenes Handy (eigenes anonymes Konto) füllt so nur seinen Anteil und verdrängt andere nicht. Gilt
-- für alle Gründe: ein Konto mit zwei Geräten (Tom mit Handy und Tablet, @FU-038) teilt sich die 100 je Spiel – das reicht
-- für jedes echte Spiel (Tore, Karten, Fouls) und ist nicht umgehbar.
CREATE OR REPLACE FUNCTION match_engine.review_store(p_match public.matches, p_event jsonb, p_uid uuid, p_device_id uuid,
                                                     p_reason text, p_detail jsonb, p_base_seq bigint)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target uuid := (p_event ->> 'targetId')::uuid;
  v_at bigint := least((p_event ->> 'at')::numeric, floor(extract(epoch FROM clock_timestamp()) * 1000))::bigint;
BEGIN
  IF (SELECT count(*) FROM public.match_reviews r
       WHERE r.match_id = p_match.id AND r.kind = 'review'
         AND r.user_id IS NOT DISTINCT FROM p_uid) >= 100 THEN
    RETURN jsonb_build_object('id', p_event -> 'id', 'status', 'rejected', 'code', 'FORBIDDEN_ACTOR',
                              'detail', '{"reason": "REVIEW_LIMIT"}'::jsonb);
  END IF;
  -- Eine gespeicherte Entscheidung (auch eine zur Klärung gelegte) belegt den eindeutigen Index je Ziel – deshalb steht das
  -- Ziel einer zur Klärung gelegten Entscheidung nur im Detail.
  IF v_target IS NOT NULL
     AND (p_event ->> 'type' IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD')
          OR NOT EXISTS (SELECT 1 FROM public.match_events e WHERE e.id = v_target AND e.match_id = p_match.id)) THEN
    v_target := NULL;
  END IF;
  INSERT INTO public.match_events (
    id, match_id, type, team_id, player_id, timestamp_seconds, period, payload,
    score_home, score_away, event_format, recorded_at, client_time, clock_ms, section,
    target_event_id, base_seq, control_epoch, review_state)
  VALUES (
    (p_event ->> 'id')::uuid, p_match.id, p_event ->> 'type', (p_event ->> 'teamId')::uuid, NULL,
    coalesce((p_event ->> 'clockMs')::numeric, 0) / 1000.0, 'regular', p_event -> 'payload',
    coalesce(p_match.score_a, 0), coalesce(p_match.score_b, 0), 1, clock_timestamp(), to_timestamp(v_at / 1000.0),
    (p_event ->> 'clockMs')::integer, (p_event ->> 'section')::smallint,
    v_target, p_base_seq, (p_event ->> 'controlEpoch')::integer, 'pending');
  INSERT INTO public.match_event_authors (event_id, tournament_id, user_id, device_id, base_state)
  VALUES ((p_event ->> 'id')::uuid, p_match.tournament_id, p_uid, p_device_id, nullif(p_event -> 'baseState', 'null'::jsonb));
  INSERT INTO public.match_reviews (event_id, tournament_id, match_id, field, kind, reason, user_id, device_id, detail, created_at)
  VALUES ((p_event ->> 'id')::uuid, p_match.tournament_id, p_match.id, p_match.field, 'review', p_reason, p_uid, p_device_id,
          coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('deviceAt', v_at)
          || CASE WHEN p_event ->> 'targetId' IS NOT NULL THEN jsonb_build_object('targetId', p_event -> 'targetId')
                  ELSE '{}'::jsonb END,
          clock_timestamp());
  -- B-50 Review M2: die Art der Rechteänderung (revoked/removed/watch_only) geht an das Gerät, damit ein Zuschauer seine
  -- Lesesicht behält; sonst keine Angaben aus match_reviews an das Gerät.
  RETURN jsonb_build_object('id', p_event -> 'id', 'status', 'review', 'code', p_reason)
         || CASE WHEN p_detail ? 'change' THEN jsonb_build_object('detail', jsonb_build_object('change', p_detail -> 'change'))
                 ELSE '{}'::jsonb END;
END;
$$;

-- Wiederholung eines schon zur Klärung gelegten Eintrags: wieder „review“ mit demselben Grund (nie duplicate).
CREATE OR REPLACE FUNCTION match_engine.review_repeat(p_event jsonb) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('id', p_event -> 'id', 'status', 'review', 'code', r.reason)
         || CASE WHEN r.detail ? 'change' THEN jsonb_build_object('detail', jsonb_build_object('change', r.detail -> 'change'))
                 ELSE '{}'::jsonb END
    FROM public.match_reviews r
    JOIN public.match_events e ON e.id = r.event_id
   WHERE r.event_id = (p_event ->> 'id')::uuid AND r.kind = 'review' AND e.review_state = 'pending';
$$;

-- Steuer verloren (@FU-036, @FU-037, @FU-038): NULL = normaler Weg (auch: Gerät hat die gesendete Epoche nie gehalten, z. B.
-- freies Feld beim gleichzeitigen Anpfiff @FU-030 -> NOT_CONTROLLER wie bisher). Sonst {route, reason, detail}:
--   review – nach der Übernahme gemacht, Uhr-/Statuseintrag (W1), mögliche Doppelung (K2) oder seit der Übernahme eine
--            Überschreibung des Stands (Direkteintrag/Korrektur);
--   auto   – eindeutig vor der Übernahme gemacht: zählt wie gesendet, mit Hinweis.
-- Turnierleitung: nur wo die Feldsteuerung gilt (laufendes Spiel, Anpfiff, Wiedereröffnen; Auflage Bauplan § 20).
CREATE OR REPLACE FUNCTION match_engine.review_route(p_match public.matches, p_epoch_now integer, p_event jsonb,
                                                     p_device_at bigint, p_uid uuid, p_device_id uuid, p_actor text,
                                                     p_status text)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_record_types constant text[] := ARRAY['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                                          'FOUL', 'SUBSTITUTION'];
  c_live_states constant text[] := ARRAY['running', 'paused', 'section_break', 'decision_pending', 'shootout'];
  v_epoch integer := (p_event ->> 'controlEpoch')::integer;
  v_type text := p_event ->> 'type';
  v_taken timestamptz;
  v_own_start timestamptz;
  v_detail jsonb;
BEGIN
  IF p_device_id IS NULL OR v_epoch IS NULL OR p_epoch_now IS NULL OR v_epoch >= p_epoch_now
     OR v_type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD') THEN
    RETURN NULL;
  END IF;
  IF p_actor = 'leitung' AND NOT (p_status = ANY (c_live_states) OR v_type IN ('MATCH_START', 'REOPEN')) THEN
    RETURN NULL;
  END IF;
  SELECT l.claimed_at INTO v_own_start
    FROM public.field_control_log l
   WHERE l.tournament_id = p_match.tournament_id AND l.field = p_match.field AND l.epoch = v_epoch
     AND l.holder_user_id = p_uid AND l.holder_device_id = p_device_id;
  IF v_own_start IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT l.claimed_at INTO v_taken
    FROM public.field_control_log l
   WHERE l.tournament_id = p_match.tournament_id AND l.field = p_match.field AND l.epoch > v_epoch
   ORDER BY l.epoch
   LIMIT 1;
  v_detail := jsonb_build_object('controlEpoch', v_epoch, 'epochNow', p_epoch_now,
                                 'takenAt', floor(extract(epoch FROM v_taken) * 1000)::bigint);
  IF v_taken IS NULL OR p_device_at >= floor(extract(epoch FROM v_taken) * 1000)::bigint THEN
    RETURN jsonb_build_object('route', 'review', 'reason', 'CONTROL_LOST', 'detail', v_detail || '{"timing": "after"}'::jsonb);
  END IF;
  -- Review m3: vor dem Beginn der eigenen Steuer-Epoche kann das Gerät nicht eingetragen haben (zurückdatiert oder Uhr
  -- falsch) – nicht von selbst einsortieren.
  IF p_device_at < floor(extract(epoch FROM v_own_start) * 1000)::bigint THEN
    RETURN jsonb_build_object('route', 'review', 'reason', 'CONTROL_LOST',
                              'detail', v_detail || '{"timing": "before", "why": "IMPLAUSIBLE_TIME"}'::jsonb);
  END IF;
  IF NOT (v_type = ANY (c_record_types)) THEN
    RETURN jsonb_build_object('route', 'review', 'reason', 'CONTROL_LOST',
                              'detail', v_detail || '{"timing": "before", "why": "STATUS_EVENT"}'::jsonb);
  END IF;
  IF EXISTS (SELECT 1 FROM public.match_events e
               JOIN public.match_event_authors a ON a.event_id = e.id
              WHERE e.match_id = p_match.id AND e.event_format IS NOT NULL AND e.review_state IS NULL
                AND e.recorded_at >= v_taken AND e.type = v_type
                AND e.team_id IS NOT DISTINCT FROM (p_event ->> 'teamId')::uuid
                AND (a.user_id IS DISTINCT FROM p_uid OR a.device_id IS DISTINCT FROM p_device_id)) THEN
    RETURN jsonb_build_object('route', 'review', 'reason', 'CONTROL_LOST',
                              'detail', v_detail || '{"timing": "before", "why": "DUPLICATE"}'::jsonb);
  END IF;
  IF EXISTS (SELECT 1 FROM public.match_events e
              WHERE e.match_id = p_match.id AND e.event_format IS NOT NULL AND e.review_state IS NULL
                AND e.recorded_at >= v_taken AND e.type IN ('RESULT_ENTRY', 'CORRECTION')) THEN
    RETURN jsonb_build_object('route', 'review', 'reason', 'CONTROL_LOST',
                              'detail', v_detail || '{"timing": "before", "why": "OVERRIDE"}'::jsonb);
  END IF;
  RETURN jsonb_build_object('route', 'auto', 'reason', 'CONTROL_LOST', 'detail', v_detail || '{"timing": "before"}'::jsonb);
END;
$$;

-- Entscheidung prüfen (@FU-038, @FU-095): NULL = gültig; sonst die Ablehnung. Ziel muss ein offener Klärungseintrag
-- DIESES Spiels sein; übernommen werden nur Spielstand-, Karten-, Straf-, Foul- und Wechsel-Einträge.
CREATE OR REPLACE FUNCTION match_engine.review_target_check(p_match_id uuid, p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_record_types constant text[] := ARRAY['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                                          'FOUL', 'SUBSTITUTION'];
  v_target uuid := (p_event ->> 'targetId')::uuid;
  v_type text;
BEGIN
  IF v_target IS NOT NULL THEN
    SELECT e.type INTO v_type
      FROM public.match_events e
      JOIN public.match_reviews r ON r.event_id = e.id AND r.kind = 'review'
     WHERE e.id = v_target AND e.match_id = p_match_id AND e.review_state = 'pending';
  END IF;
  IF v_type IS NULL THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'UNKNOWN_TARGET', 'detail', '{"reason": "NOT_IN_REVIEW"}'::jsonb);
  END IF;
  IF EXISTS (SELECT 1 FROM public.match_events d
              WHERE d.target_event_id = v_target AND d.type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD') AND d.review_state IS NULL) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'UNKNOWN_TARGET', 'detail', '{"reason": "ALREADY_DECIDED"}'::jsonb);
  END IF;
  IF p_event ->> 'type' = 'REVIEW_ACCEPT' AND NOT (v_type = ANY (c_record_types)) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_PAYLOAD', 'detail', '{"reason": "NOT_ACCEPTABLE"}'::jsonb);
  END IF;
  RETURN NULL;
END;
$$;

-- Kopie des Klärungseintrags für „Übernehmen“: gleicher Typ und gleiche Angaben, Akteur leitung, targetId = Eintrag, ID fest
-- aus der Entscheidung abgeleitet (Wiederholung der Entscheidung ist duplicate, keine zweite Kopie).
CREATE OR REPLACE FUNCTION match_engine.review_copy(p_event jsonb, p_at bigint) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('id', md5('a35-review-copy:' || (p_event ->> 'id'))::uuid::text,
                            'type', e.type, 'actor', 'leitung', 'at', p_at, 'section', e.section, 'clockMs', e.clock_ms,
                            'teamId', e.team_id::text, 'targetId', e.id::text, 'payload', e.payload)
    FROM public.match_events e
   WHERE e.id = (p_event ->> 'targetId')::uuid;
$$;

-- Recht verloren (I-4): Einträge zur Klärung statt FORBIDDEN_ACTOR; nichts wird angewendet, kein field_control, Antwort
-- ohne Stand. Regel F6 (Daniel 23.10., @HE-080, @HE-056): alles, was das Gerät bis zu seiner ERSTEN Verbindung nach dem
-- Entzug ohne Netz gemacht hat (Gerätezeit <= erster Kontakt), geht zur Klärung; was es danach macht -> FORBIDDEN_ACTOR
-- RIGHTS_REVOKED. Der erste Kontakt steht je Turnier und Konto in revoked_device_contacts (neu bei erneutem Entzug;
-- Nachblick N1: eine gewechselte Geräte-ID öffnet kein neues Fenster).
-- Abgeschlossenes Turnier, Spiel ohne zwei Teams oder nie Schreiber gewesen: wie vor A-35 (FORBIDDEN_ACTOR).
CREATE OR REPLACE FUNCTION match_engine.revoked_intake(p_tournament_id uuid, p_match_id uuid, p_events jsonb,
                                                       p_uid uuid, p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_change   jsonb := match_engine.rights_change(p_tournament_id, p_uid);
  v_since    timestamptz := to_timestamp((v_change ->> 'since')::numeric / 1000.0);
  v_limit_ms bigint;
  v_match    public.matches%ROWTYPE;
  v_raw      jsonb;
  v_event    jsonb;
  v_existing record;
  v_result   jsonb;
  v_results  jsonb := '[]'::jsonb;
  v_base_seq bigint;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF v_change IS NULL OR v_match.id IS NULL OR v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL
     OR public.tournament_is_closed(p_tournament_id) THEN
    SELECT jsonb_agg(jsonb_build_object(
             'id', coalesce(to_jsonb(match_engine.normalize_uuid(e -> 'id')), e -> 'id', 'null'::jsonb),
             'status', 'rejected', 'code', 'FORBIDDEN_ACTOR') ORDER BY ord)
      INTO v_results
      FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord);
    RETURN jsonb_build_object('results', v_results, 'state', NULL,
                              'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
  END IF;
  SELECT coalesce(max(e.seq), 0) INTO v_base_seq FROM public.match_events e WHERE e.match_id = p_match_id;
  -- F6: erster Kontakt nach dem (jüngsten) Entzug; ein neuer Entzug (anderes declined_at) beginnt neu.
  INSERT INTO public.revoked_device_contacts (tournament_id, user_id, first_device_id, revoked_since)
  VALUES (p_tournament_id, p_uid, p_device_id, v_since)
  ON CONFLICT (tournament_id, user_id) DO UPDATE
     SET revoked_since = EXCLUDED.revoked_since, first_device_id = EXCLUDED.first_device_id, first_contact_at = now()
   WHERE public.revoked_device_contacts.revoked_since IS DISTINCT FROM EXCLUDED.revoked_since;
  SELECT floor(extract(epoch FROM c.first_contact_at) * 1000)::bigint INTO v_limit_ms
    FROM public.revoked_device_contacts c
   WHERE c.tournament_id = p_tournament_id AND c.user_id = p_uid;
  FOR v_raw IN SELECT x.e FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord) ORDER BY x.ord LOOP
    v_event := match_engine.envelope(v_raw, v_match.team_a_id::text, v_match.team_b_id::text);
    IF v_event IS NULL THEN
      v_result := jsonb_build_object('id', coalesce(CASE WHEN jsonb_typeof(v_raw) = 'object' THEN v_raw -> 'id' END, 'null'::jsonb),
                                     'status', 'rejected', 'code', 'INVALID_PAYLOAD');
    ELSE
      SELECT e.match_id, e.seq,
             match_engine.dedupe_key(jsonb_build_object(
               'type', e.type, 'teamId', e.team_id::text, 'targetId', e.target_event_id::text,
               'section', e.section, 'clockMs', e.clock_ms, 'payload', e.payload)) AS content
        INTO v_existing
        FROM public.match_events e
       WHERE e.id = (v_event ->> 'id')::uuid;
      IF FOUND THEN
        IF v_existing.match_id = p_match_id AND v_existing.content = match_engine.dedupe_key(v_event) THEN
          v_result := coalesce(match_engine.review_repeat(v_event),
                               jsonb_build_object('id', v_event -> 'id', 'status', 'duplicate', 'seq', v_existing.seq));
        ELSE
          v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'ID_CONFLICT');
        END IF;
      ELSIF v_event ->> 'type' IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD') THEN
        -- B-50 Review M3: eine Entscheidung ohne Recht ist nie selbst ein Klärungseintrag – glatt nicht angenommen.
        v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'FORBIDDEN_ACTOR',
                                       'detail', '{"reason": "RIGHTS_REVOKED"}'::jsonb);
      ELSIF (v_event ->> 'at')::numeric > v_limit_ms THEN
        v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'FORBIDDEN_ACTOR',
                                       'detail', '{"reason": "RIGHTS_REVOKED"}'::jsonb);
      ELSE
        v_result := match_engine.review_store(v_match, v_event, p_uid, p_device_id, 'RIGHTS_REVOKED',
                                              jsonb_build_object('change', v_change ->> 'change'), v_base_seq);
      END IF;
    END IF;
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;
  RETURN jsonb_build_object('results', v_results, 'state', NULL,
                            'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
END;
$$;

REVOKE ALL ON FUNCTION match_engine.rights_change(uuid, uuid),
                       match_engine.review_store(public.matches, jsonb, uuid, uuid, text, jsonb, bigint),
                       match_engine.review_repeat(jsonb),
                       match_engine.review_route(public.matches, integer, jsonb, bigint, uuid, uuid, text, text),
                       match_engine.review_target_check(uuid, jsonb),
                       match_engine.review_copy(jsonb, bigint),
                       match_engine.revoked_intake(uuid, uuid, jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- Review m1: closed_intake (Fassung 20261113_003 + nur hinzugefügte Zeilen) beantwortet die Wiederholung eines schon zur
-- Klärung gelegten Eintrags nach dem Abschluss mit review statt duplicate (sonst buchte das Gerät ein Geistertor).
CREATE OR REPLACE FUNCTION match_engine.closed_intake(p_tournament_id uuid, p_match_id uuid, p_events jsonb,
                                                      p_actor uuid, p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match    public.matches;
  v_raw      jsonb;
  v_event    jsonb;
  v_id       jsonb;
  v_existing record;
  v_results  jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  FOR v_raw IN SELECT x.e FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord) ORDER BY x.ord LOOP
    v_event := match_engine.envelope(v_raw, v_match.team_a_id::text, v_match.team_b_id::text);
    v_id := coalesce(v_event -> 'id', CASE WHEN jsonb_typeof(v_raw) = 'object' THEN v_raw -> 'id' END, 'null'::jsonb);
    IF v_event IS NULL THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'rejected', 'code', 'INVALID_PAYLOAD'));
      CONTINUE;
    END IF;
    SELECT e.match_id, e.seq,
           match_engine.dedupe_key(jsonb_build_object(
             'type', e.type, 'teamId', e.team_id::text, 'targetId', e.target_event_id::text,
             'section', e.section, 'clockMs', e.clock_ms, 'payload', e.payload)) AS content
      INTO v_existing
      FROM public.match_events e
     WHERE e.id = (v_event ->> 'id')::uuid;
    IF FOUND THEN
      IF v_existing.match_id = p_match_id AND v_existing.content = match_engine.dedupe_key(v_event) THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_event -> 'id', 'status', 'duplicate',
                                                                       'seq', v_existing.seq));
      ELSE
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_event -> 'id', 'status', 'rejected',
                                                                       'code', 'ID_CONFLICT'));
      END IF;
      -- A-35 (Review m1): schon zur Klaerung gelegt -> wieder review (nie duplicate = angenommen).
      IF v_results -> -1 ->> 'status' = 'duplicate' AND match_engine.review_repeat(v_event) IS NOT NULL THEN
        v_results := (v_results - (-1)) || jsonb_build_array(match_engine.review_repeat(v_event));
      END IF;
      CONTINUE;
    END IF;
    INSERT INTO public.late_entries (tournament_id, match_id, event_id, event, actor, device_id)
    VALUES (p_tournament_id, p_match_id, (v_event ->> 'id')::uuid, v_raw, p_actor, p_device_id)
    ON CONFLICT (match_id, event_id) DO NOTHING;
    v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_event -> 'id', 'status', 'review',
                                                                   'code', 'AFTER_FINISH'));
  END LOOP;
  RETURN jsonb_build_object('results', v_results, 'state', NULL, 'tournamentClosed', true,
                            'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
END;
$$;
REVOKE ALL ON FUNCTION match_engine.closed_intake(uuid, uuid, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. append_match_events (Fassung 20261113_003 + A-35, nur hinzugefügte Zeilen)
-- ---------------------------------------------------------------------------------------------------------------
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
  -- A-25n (R-A25b-1): REOPEN, das eine Nichtantritt-Wertung zuruecknimmt (Spiel wird wieder 'scheduled', nicht laufend).
  v_forfeit_reopen boolean;
  -- Spiel beenden (20261110_009, Review M3): Ergebnis der Turnierleitung in ein angepfiffenes Spiel -- ohne Feldsteuerung.
  v_end_by_lead boolean;
  -- A-35 (Klaerungsliste): Weiche je Ereignis (match_engine.review_route), Entscheidung, Kopie beim Uebernehmen.
  c_review_copy_types constant text[] := ARRAY['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
                                               'TIME_PENALTY', 'FOUL', 'SUBSTITUTION'];
  v_route jsonb;
  v_review_reject jsonb;
  v_copy jsonb;
  v_copy_step jsonb;
  v_copy_seq bigint;
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
  -- A-35 (I-4, @FU-017, @HE-056, @HE-080): wer hier eingetragen hat und jetzt entzogen, entfernt oder zum Zuschauer gemacht
  -- ist, bekommt seine Eintraege zur Klaerung statt FORBIDDEN_ACTOR (nichts wird angewendet, Antwort ohne Stand).
  ELSIF v_tournament_id IS NOT NULL AND match_engine.rights_change(v_tournament_id, v_uid) IS NOT NULL THEN
    RETURN match_engine.revoked_intake(v_tournament_id, p_match_id, p_events, v_uid, p_device_id);
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
  -- A-21a (R-EA-5, Review B3): abgeschlossenes Turnier -> spaete Eintraege aufbewahren (late_entries), nichts anwenden,
  -- keine field_control-Zeile. Steht VOR dem Feld-INSERT (I-5: wer append neu fasst, uebernimmt diesen Block hier).
  IF public.tournament_is_closed(v_match.tournament_id) THEN
    RETURN match_engine.closed_intake(v_match.tournament_id, p_match_id, p_events, v_uid, p_device_id);
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
        -- A-35: ein schon zur Klaerung gelegter Eintrag bleibt beim Wiederholen „zu klaeren“ (nie duplicate = angenommen).
        IF v_result ->> 'status' = 'duplicate' THEN
          v_result := coalesce(match_engine.review_repeat(v_event), v_result);
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
        -- A-25n (R-A25b-1, @W2A-026): das Zuruecknehmen einer Wertung startet kein Spiel (Ziel 'scheduled') -- es
        -- braucht keine Steuer, wie Direkteintrag und Korrektur an nicht laufenden Spielen (Auflage Bauplan § 20).
        v_forfeit_reopen := coalesce(v_event ->> 'type' = 'REOPEN' AND v_state ->> 'status' = 'finished'
                                     AND v_state -> 'overrides' -> -1 ->> 'kind' = 'forfeit', false);
        -- Spiel beenden (20261110_009, @FU-112, @FU-115, Review M3): die Turnierleitung beendet ein angepfiffenes Spiel mit
        -- ihrem Ergebnis auch, wenn ein anderes Geraet das Feld steuert -- VOR dem ganzen c3-Block: keine Ablehnung, kein
        -- Anspruch auf ein freies Feld, keine Epochen-Pruefung (der Halter bleibt). Nicht im Strafstossschiessen (@FU-118:
        -- dort gilt c3, die Rechenfunktion lehnt ohnehin ab); Helfer pruefen c3 und die Rechenfunktion (@FU-113).
        v_end_by_lead := coalesce(v_actor = 'leitung' AND v_event ->> 'type' = 'RESULT_ENTRY'
                                  AND v_state ->> 'status' IN ('running', 'paused', 'section_break', 'decision_pending'), false);
        IF NOT v_end_by_lead
           AND (v_state ->> 'status' = ANY (c_live_states)
                OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen)) THEN
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

        -- A-35 (Klaerungsliste): Entscheidungen der Turnierleitung brauchen keine Feldsteuerung (wie das Beenden im
        -- Spielplan), nur einen offenen Klaerungseintrag dieses Spiels (@FU-038, @FU-095). Eintraege eines Geraets, das das
        -- Steuer verloren hat, gehen zur Klaerung (@FU-036, @FU-038) -- eindeutig vor der Uebernahme gemacht (@FU-037)
        -- am Steuer vorbei in die Rechenfunktion. Geraetezeit = gesendetes `at` (nicht die geklemmte Serverzeit).
        v_route := NULL;
        v_review_reject := NULL;
        v_copy := NULL;
        IF v_actor = 'leitung' AND v_event ->> 'type' IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD') THEN
          v_control_reject := NULL;
          v_claim_pending := false;
          v_review_reject := match_engine.review_target_check(p_match_id, v_event);
        ELSIF NOT v_end_by_lead THEN
          v_route := match_engine.review_route(v_match, v_fc.epoch, v_event, (v_raw ->> 'at')::numeric::bigint, v_uid,
                                               p_device_id, v_actor, v_state ->> 'status');
          IF v_route ->> 'route' = 'auto' THEN
            v_control_reject := NULL;
            v_claim_pending := false;
          END IF;
        END IF;
        IF v_review_reject IS NOT NULL THEN
          v_result := v_review_reject || jsonb_build_object('id', v_event -> 'id');
        ELSIF v_route ->> 'route' = 'review' THEN
          v_result := match_engine.review_store(v_match, v_event || jsonb_build_object('at', (v_raw ->> 'at')::numeric::bigint),
                                                v_uid, p_device_id, v_route ->> 'reason', v_route -> 'detail', v_base_seq);
        ELSE
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
            -- A-25n (R-A25b-2): eine Nichtantritt-Wertung braucht kein Strafstossergebnis (beide fehlen im K.-o.: 0:0).
            WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout') AND NOT ((v_event -> 'payload') ? 'forfeit')
                 AND (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamAId'))
                     = (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamBId')) THEN 'SHOOTOUT_REQUIRED'
          END;
          IF v_shootout_violation IS NOT NULL THEN
            v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'INVALID_PAYLOAD',
                                           'detail', jsonb_build_object('reason', v_shootout_violation));
          END IF;
        END IF;

        -- A-35 (@FU-095): „Uebernehmen“ wirkt ueber die Kopie des Klaerungseintrags (gleicher Typ, targetId = Eintrag, Akteur
        -- leitung). Gilt die Kopie nicht (z. B. beendetes K.-o.-Spiel), wird die Entscheidung mit deren Grund abgelehnt.
        IF v_result ->> 'status' = 'accepted' AND v_event ->> 'type' = 'REVIEW_ACCEPT' THEN
          v_copy := match_engine.review_copy(v_event, v_at_eval);
          v_copy_step := public.match_continue(v_step -> 'state', jsonb_build_array(v_copy), v_ctx, v_transitions, 'log');
          IF v_copy_step -> 'results' -> 0 ->> 'status' IS DISTINCT FROM 'accepted' THEN
            v_result := (v_copy_step -> 'results' -> 0) || jsonb_build_object('id', v_event -> 'id');
            v_copy := NULL;
          END IF;
        END IF;
        -- A-35: lehnt die Rechenfunktion einen eindeutig vor der Uebernahme gemachten Eintrag ab (@FU-037, z. B. Spiel
        -- inzwischen beendet) oder einen Spielstand-/Karten-/Straf-/Foul-/Wechsel-Eintrag nach dem Ende (@FU-116 Z. 2),
        -- geht er zur Klaerung statt verloren.
        IF v_result ->> 'status' = 'rejected' AND v_route ->> 'route' = 'auto' THEN
          -- @FU-130 (Daniel 23.10.): nach dem Abpfiff angekommen -> AFTER_END (zaehlt erst nach „Uebernehmen“).
          v_result := match_engine.review_store(v_match, v_event || jsonb_build_object('at', (v_raw ->> 'at')::numeric::bigint),
                                                v_uid, p_device_id,
                                                CASE WHEN v_result ->> 'code' = 'MATCH_FINISHED' THEN 'AFTER_END' ELSE 'CONTROL_LOST' END,
                                                (v_route -> 'detail') || jsonb_build_object('rejected', v_result ->> 'code'),
                                                v_base_seq);
        ELSIF v_result ->> 'status' = 'rejected' AND v_result ->> 'code' = 'MATCH_FINISHED'
              AND v_event ->> 'type' = ANY (c_review_copy_types) THEN
          v_result := match_engine.review_store(v_match, v_event || jsonb_build_object('at', (v_raw ->> 'at')::numeric::bigint),
                                                v_uid, p_device_id, 'AFTER_END', '{}'::jsonb, v_base_seq);
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
          -- A-35 (@FU-095): zur Entscheidung „Uebernehmen“ die Kopie direkt dahinter (zaehlt; Urheber = wer den Eintrag gemacht
          -- hat, die Entscheidung traegt die Turnierleitung).
          IF v_copy IS NOT NULL THEN
            IF v_stored_count >= 2000 THEN
              RAISE EXCEPTION 'append_match_events: Spiel % hat bereits % gespeicherte Ereignisse (Obergrenze 2000)',
                p_match_id, v_stored_count USING ERRCODE = '54000';
            END IF;
            v_stored_count := v_stored_count + 1;
            v_state := v_copy_step -> 'state';
            INSERT INTO public.match_events (
              id, match_id, type, team_id, player_id, timestamp_seconds, period, payload,
              score_home, score_away, event_format, recorded_at, client_time, clock_ms, section,
              target_event_id, base_seq, control_epoch)
            VALUES (
              (v_copy ->> 'id')::uuid, p_match_id, v_copy ->> 'type', (v_copy ->> 'teamId')::uuid, NULL,
              coalesce((v_copy ->> 'clockMs')::numeric, 0) / 1000.0,
              CASE v_phase_before WHEN 'overtime' THEN 'overtime' WHEN 'shootout' THEN 'penalty' ELSE 'regular' END,
              v_copy -> 'payload',
              match_engine.effective_score(v_state, v_ctx ->> 'teamAId')::integer,
              match_engine.effective_score(v_state, v_ctx ->> 'teamBId')::integer,
              1, v_now, to_timestamp(v_at_server / 1000.0),
              (v_copy ->> 'clockMs')::integer, (v_copy ->> 'section')::smallint,
              (v_copy ->> 'targetId')::uuid, v_base_seq, NULL)
            RETURNING seq INTO v_copy_seq;
            INSERT INTO public.match_event_authors (event_id, tournament_id, user_id, device_id, base_state)
            SELECT (v_copy ->> 'id')::uuid, v_match.tournament_id, a.user_id, a.device_id, NULL
              FROM public.match_event_authors a
             WHERE a.event_id = (v_copy ->> 'targetId')::uuid;
            v_accepted := v_accepted + 1;
            v_result := v_result || jsonb_build_object('appliedId', v_copy -> 'id', 'appliedSeq', v_copy_seq);
          END IF;
          -- A-35 (@FU-037): eindeutig vor der Uebernahme gemacht -> zaehlt, die Turnierleitung sieht den Hinweis
          -- „nachtraeglich eingefuegt“ (match_reviews kind notice).
          IF v_route ->> 'route' = 'auto' THEN
            INSERT INTO public.match_reviews (event_id, tournament_id, match_id, field, kind, reason, user_id, device_id, detail,
                                              created_at)
            VALUES ((v_event ->> 'id')::uuid, v_match.tournament_id, p_match_id, v_match.field, 'notice', 'CONTROL_LOST',
                    v_uid, p_device_id, (v_route -> 'detail') || jsonb_build_object('deviceAt', (v_raw ->> 'at')::numeric::bigint),
                    clock_timestamp());
          END IF;
          v_accepted := v_accepted + 1;
          v_started_now := v_started_now OR v_event ->> 'type' = 'MATCH_START';
          v_result := v_result || jsonb_build_object('seq', v_seq);
        ELSIF v_result ->> 'status' = 'noop' THEN
          -- g. noop wird nie gespeichert (K7).
          v_state := v_step -> 'state';
        END IF;
        END IF;  -- c2 (Serveruhr)
        END IF;  -- A-35 (Klaerung)
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
      -- A-25n (@W2A-022): wer nicht angetreten ist (nur Wertung im beendeten Spiel, sonst NULL).
      forfeit_absent = v_cache ->> 'forfeit_absent',
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

-- ---------------------------------------------------------------------------------------------------------------
-- 7. RPC list_match_reviews: Klärungsliste eines Turniers (B-50). Nur Turnierleitung (leadMatches), sonst []. Je Eintrag
--    Grund, Gerät/Konto als Name (nie E-Mail), der Eintrag selbst (Typ, Team, Abschnitt, Spielzeit, Angaben, Gerätezeit)
--    und – falls schon entschieden – die Entscheidung mit Person und Zeit. Hinweise (kind notice) stehen mit dabei.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_match_reviews(p_tournament_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'eventId', r.event_id,
           'matchId', r.match_id,
           'matchNumber', m.match_number,
           'field', r.field,
           'kind', r.kind,
           'reason', r.reason,
           'detail', r.detail,
           'receivedAt', floor(extract(epoch FROM r.created_at) * 1000)::bigint,
           'author', match_engine.actor_name(r.tournament_id, r.user_id),
           'deviceLabel', (SELECT jr.device_label FROM public.tournament_join_requests jr
                            WHERE jr.tournament_id = r.tournament_id AND jr.device_user_id = r.user_id AND jr.status = 'accepted'
                            LIMIT 1),
           'entry', jsonb_build_object('type', e.type, 'teamId', e.team_id, 'section', e.section, 'clockMs', e.clock_ms,
                                       'payload', e.payload, 'targetId', e.target_event_id,
                                       'deviceAt', floor(extract(epoch FROM e.client_time) * 1000)::bigint),
           'decision', (SELECT jsonb_build_object('type', d.type, 'eventId', d.id,
                                                  'at', floor(extract(epoch FROM d.recorded_at) * 1000)::bigint,
                                                  'by', match_engine.actor_name(r.tournament_id, da.user_id))
                          FROM public.match_events d
                          LEFT JOIN public.match_event_authors da ON da.event_id = d.id
                         WHERE d.target_event_id = r.event_id AND d.type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD')
                           AND d.review_state IS NULL
                         LIMIT 1)
         ) ORDER BY r.created_at, r.event_id), '[]'::jsonb)
    FROM public.match_reviews r
    JOIN public.matches m ON m.id = r.match_id
    JOIN public.match_events e ON e.id = r.event_id
    JOIN public.tournaments t ON t.id = r.tournament_id AND t.deleted_at IS NULL
   WHERE r.tournament_id = p_tournament_id
     AND public.has_tournament_permission(p_tournament_id, 'leadMatches');
$$;
COMMENT ON FUNCTION public.list_match_reviews(uuid) IS
  'A-35 (@FU-038, @FU-095, @FU-017, @HE-056): Klärungsliste für die Turnierleitung (leadMatches), sonst []. Offen = decision null und kind review.';

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Rechte
-- ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.list_match_reviews(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_match_reviews(uuid) TO authenticated;
-- match_apply_event: wie 20260928_002 (reine Rechenfunktion, alle Rollen).
REVOKE ALL ON FUNCTION public.match_apply_event(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_apply_event(jsonb, jsonb, jsonb, jsonb) TO authenticated, anon, service_role;
-- append_match_events: unveraendert (ausdruecklich wiederholt).
REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

COMMIT;
