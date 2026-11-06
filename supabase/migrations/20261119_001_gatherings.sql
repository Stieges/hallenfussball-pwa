-- supabase/migrations/20261119_001_gatherings.sql
-- A1 Veranstaltung – Daten und Server (Record docs/anforderungen/2026-11-06_veranstaltung-mehrere-turniere.md, Abschnitt
-- „Umsetzungsvorgabe A1“; GATE 2 _quellen/2026-11-06_veranstaltung-gate2.md). Eine Veranstaltung fasst mehrere Turniere
-- eines Kontos unter einem Link zusammen; in Datenbank und Code heisst sie `gathering` („event“ ist im Bestand das Ereignis
-- im Spiel: match_events, correctEvents).
-- Szenarien (Server): @VA-011, @VA-021, @VA-014 (Server-Teil) vollstaendig; Server-Teil von @VA-001, @VA-002, @VA-003,
--   @VA-004, @VA-006, @VA-012, @VA-015, @VA-016, @VA-019, @VA-020. Pruefregel @ZM-180 (monotone Version, echte Antwort).
--
-- Inhalt:
--   1. Tabelle gatherings (Name 1-80 Zeichen nach btrim ohne Steuer-/Formatzeichen, Code ^[A-Z0-9]{6}$ eindeutig und
--      beim Erzeugen auch gegen tournaments.share_code geprueft), Trigger updated_at, Index (owner_id); hoechstens 50 je
--      Konto (create_gathering).
--   2. Tabelle gathering_members (R0, Platz fuer Mitglieder der Veranstaltung, leer; Form wie tournament_collaborators),
--      Trigger gathering_members_guard: keine Zeile direkt ueber die Schnittstelle, co-admin nur fuer ein echtes Konto.
--   3. tournaments.gathering_id (FK on delete set null, Teil-Index). Trigger tournaments_protect_gathering_id: Client-Rollen
--      aendern das Feld nie (HF006), beim INSERT immer NULL (Kopie, Import, Abgleich, @VA-020). Trigger
--      tournaments_touch_gathering_*: Papierkorb, Zurueckholen und endgueltiges Loeschen eines zugeordneten Turniers setzen
--      gatherings.updated_at (monotone Version, @ZM-180).
--   4. tournaments_guard_lifecycle woertlich aus 20261113_003 (md5 a7ce4fa88b5e62997bf26bcecdfc9a0a), nur c_free um
--      gathering_id erweitert (@VA-019, @VA-015 Z. 3); Fassung dieser Datei md5 3958921a7e64a12f2d4b87e530b28d73.
--   5. Funktionen has_gathering_permission, create_gathering, rename_gathering, delete_gathering, set_gathering_tournaments
--      (SECURITY DEFINER, search_path fest, EXECUTE nur authenticated) und public_gathering (anon, authenticated,
--      service_role). public_view.public_payload woertlich aus 20261117_104 (zuletzt gueltige Fassung, md5
--      9a606911268600767bd20c5ad7e6f66d; 20261118_004/_007/_008 ersetzen sie nicht; Fassung dieser Datei md5
--      339aea3bc0ecc439185def6a93cb59c6), nur um gathering_code ergaenzt: nur fuer
--      audience 'viewer', nur wenn das Turnier oeffentlich ist und zu einer Veranstaltung gehoert (@VA-013, @VA-014).
--   6. Rechte: REVOKE ALL auf beiden Tabellen fuer PUBLIC, anon, authenticated; SELECT auf gatherings fuer authenticated
--      (RLS: nur readGathering), SELECT fuer ci_schema_reader (Schema-Dump des Drift-Checks).
--
-- Lesarten (Record, Abschnitt „Begriffe“, Controller gilt nach Vorschlag):
--   Ortszeit/„heute“ = Europe/Berlin (wie helper_code_cutoff). Beginn = kleinster matches.scheduled_start, sonst
--   tournaments.start_time, sonst ohne. „angepfiffen“ = match_status running/paused/finished (wie tournament_lifecycle).
--   Zustand: cancelled (lifecycle_status), finished (lifecycle_status oder angepfiffen und heute >= date + 2), live
--   (angepfiffen), sonst planned. last_match_started: alle Spiele mit dem spaetesten scheduled_start angepfiffen oder
--   uebersprungen. „steht bevor“: zugeordnet, nicht im Papierkorb, planned, date >= heute.
--   public_gathering(code): {state:'not_found'} (Code unbekannt/geloescht, nicht unterscheidbar; auch: alles vorbei und
--   keins oeffentlich) | {state:'pending', version, server_now, name} (keins oeffentlich, aber eins steht bevor, oder
--   noch gar keins zugeordnet; ohne Namen und Anzahl) | {state:'full', version, server_now, name, tournaments:[{title, date,
--   begin, location_name, state, last_match_started, share_code}]} (nur oeffentliche, nicht geloeschte Turniere; Schluessel
--   ohne Wert fehlen). Immer Voll-Antwort, kein since.
--   version = Mikrosekunden von greatest(gatherings.updated_at, tournaments.updated_at, matches.actual_start,
--   matches.updated_at, public_view.structure_changes.changed_at) der zugeordneten, nicht geloeschten Turniere,
--   hoechstens „jetzt - 5 s“ (c_lag_us). matches.updated_at und structure_changes zusaetzlich zur Vorgabe: ein
--   zurueckgenommener Anpfiff (actual_start wieder NULL) oder ein geloeschtes Spiel liesse das Maximum sonst sinken.
--   Zuordnen und Loesen aendern weder tournaments.version noch change_revision (Optimistic Lock am Geraet, @VA-021 Z. 3).
--
-- Fehlercodes (Projektmuster HF0xx, nie PTxxx; Liste fortgeschrieben):
--   HF001 make_tournament_public (Freigabe fehlt) · HF002 Herkunft · HF003 getragene Farbe · HF004 change_revision ·
--   HF005 (vergeben) · HF006 GATHERING_NOT_ALLOWED (Recht fehlt, kein echtes Konto, Turnier eines anderen Kontos,
--   direktes Schreiben von tournaments.gathering_id) · HF007 GATHERING_CONFLICT (Turnier gehoert schon zu einer anderen
--   Veranstaltung) · HF008 GATHERING_NOT_FOUND (Veranstaltung oder Turnier fehlt oder liegt im Papierkorb) ·
--   HF009 GATHERING_LIMIT (mehr als 50 je Konto) · HF010 GATHERING_NAME_INVALID (leer, zu lang, Steuerzeichen) ·
--   HF011 GATHERING_TOO_MANY (mehr als 50 Turniere je Veranstaltung; Review #449 B5).
--   Dazu 22023 GATHERING_INVALID_INPUT (dasselbe Turnier in add und remove).
--
-- Bestandsdaten: keine Aenderung; alle Turniere starten ohne Veranstaltung (gathering_id NULL), die Turnierantwort eines
--   Turniers ohne Veranstaltung bleibt Byte fuer Byte gleich. Kein Backfill.
-- Voraussetzungen (Fail-fast unten): 20261110_002 (is_real_account), 20261113_003 (Lebenszyklus, Waechter in genau der
--   Fassung oben oder dieser Datei), 20261117_104 (public_view, public_payload in der Fassung oben oder dieser Datei),
--   ci_schema_reader, generate_share_code, update_updated_at.
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER/POLICY IF EXISTS
--   vor CREATE, REVOKE/GRANT.
--
-- RUECKWEG: eigene Datei supabase/rollbacks/20261119_001_gatherings_rollback.sql, EIN Block (Waechter und public_payload
--   woertlich zurueck, Funktionen, Trigger, Spalte und Tabellen weg). Vorher die App ohne Veranstaltungs-Client deployen.
--   Veranstaltungen und Zuordnungen gehen dabei verloren (vorher per COPY sichern); Turniere bleiben unveraendert.
--   Belegt in scripts/gatherings-check.sh (Kategorie X: Schema danach = vorher).
--
-- Produktion: nur nach Daniels Freigabe (Freigabe-Unterlage A1 mit SQL und SHA-256) durch den Controller. Dieser Branch
-- spielt nichts ein. Typen neu (src/types/supabase.ts).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_guard text;
  v_payload text;
BEGIN
  IF to_regprocedure('public.is_real_account()') IS NULL
     OR to_regprocedure('public.generate_share_code()') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('public.tournaments_guard_lifecycle()') IS NULL
     OR to_regprocedure('public_view.public_payload(uuid,bigint,text,text)') IS NULL
     OR to_regclass('public_view.structure_changes') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'lifecycle_status')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261119_001_gatherings: Voraussetzungen fehlen -- zuerst 20261110_002, 20261113_003 und 20261117_104 einspielen';
  END IF;
  -- Nie still eine andere Fassung ueberschreiben: Waechter aus 20261113_003, public_payload aus 20261117_104 -- oder genau
  -- die Fassung dieser Datei (md5 des Funktionstexts, nicht nur der Stempel: eine spaetere Fassung mit Stempel bricht ab).
  SELECT prosrc INTO v_guard FROM pg_proc WHERE oid = 'public.tournaments_guard_lifecycle()'::regprocedure;
  IF md5(v_guard) NOT IN ('a7ce4fa88b5e62997bf26bcecdfc9a0a', '3958921a7e64a12f2d4b87e530b28d73') THEN
    RAISE EXCEPTION '20261119_001_gatherings: tournaments_guard_lifecycle hat eine unbekannte Fassung (md5 %) -- erst klaeren', md5(v_guard);
  END IF;
  SELECT prosrc INTO v_payload FROM pg_proc WHERE oid = 'public_view.public_payload(uuid,bigint,text,text)'::regprocedure;
  IF md5(v_payload) NOT IN ('9a606911268600767bd20c5ad7e6f66d', '339aea3bc0ecc439185def6a93cb59c6') THEN
    RAISE EXCEPTION '20261119_001_gatherings: public_view.public_payload hat eine unbekannte Fassung (md5 %) -- erst klaeren', md5(v_payload);
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tabelle gatherings
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gatherings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL CONSTRAINT gatherings_name_valid
                          CHECK (char_length(btrim(name)) BETWEEN 1 AND 80
                                 AND name !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]'),
  share_code            text NOT NULL CONSTRAINT gatherings_share_code_format CHECK (share_code ~ '^[A-Z0-9]{6}$'),
  share_code_created_at timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gatherings_share_code_key UNIQUE (share_code)
);
CREATE INDEX IF NOT EXISTS gatherings_owner_id_idx ON public.gatherings (owner_id);
COMMENT ON TABLE public.gatherings IS
  '20261119_001 (A1): Veranstaltung -- mehrere Turniere eines Kontos unter einem Link (/veranstaltung/<share_code>). Schreiben nur ueber create_/rename_/delete_gathering und set_gathering_tournaments; Lesen RLS readGathering (im MVP nur der Eigentuemer, @VA-011).';

DROP TRIGGER IF EXISTS gatherings_updated_at ON public.gatherings;
CREATE TRIGGER gatherings_updated_at BEFORE UPDATE ON public.gatherings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Tabelle gathering_members (R0: Platz, leer; Rollen kommen mit R1, Record Rollen und Rechte)
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gathering_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id   uuid NOT NULL REFERENCES public.gatherings(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text NOT NULL CONSTRAINT gathering_members_role_check CHECK (role IN ('co-admin', 'helper')),
  label          text CONSTRAINT gathering_members_label_valid
                   CHECK (label IS NULL OR (char_length(btrim(label)) BETWEEN 1 AND 40
                                            AND label !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]')),
  allowed_fields integer[],
  invited_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at     timestamptz DEFAULT now(),
  accepted_at    timestamptz,
  declined_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gathering_members_one_active
  ON public.gathering_members (gathering_id, user_id) WHERE declined_at IS NULL;
CREATE INDEX IF NOT EXISTS gathering_members_user_id_idx ON public.gathering_members (user_id);
COMMENT ON TABLE public.gathering_members IS
  '20261119_001 (R0): Mitglieder der Veranstaltung (Form wie tournament_collaborators; declined_at = entzogen). In A1 leer, keine Funktion schreibt, keine Rechte fuer Clients.';

CREATE OR REPLACE FUNCTION public.gathering_members_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Mitglieder der Veranstaltung entstehen nur ueber Server-Funktionen.'
      USING ERRCODE = 'HF006';
  END IF;
  IF NEW.role = 'co-admin' AND NEW.user_id IS NOT NULL
     AND coalesce((SELECT (to_jsonb(u) ->> 'is_anonymous')::boolean FROM auth.users u WHERE u.id = NEW.user_id), false) THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Co-Admin einer Veranstaltung nur mit echtem Konto.'
      USING ERRCODE = 'HF006';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gathering_members_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS gathering_members_guard ON public.gathering_members;
CREATE TRIGGER gathering_members_guard BEFORE INSERT OR UPDATE ON public.gathering_members
  FOR EACH ROW EXECUTE FUNCTION public.gathering_members_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. tournaments.gathering_id: nur der Server schreibt
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS gathering_id uuid REFERENCES public.gatherings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tournaments_gathering_id_idx ON public.tournaments (gathering_id) WHERE gathering_id IS NOT NULL;
COMMENT ON COLUMN public.tournaments.gathering_id IS
  '20261119_001 (A1, @VA-021): Veranstaltung des Turniers. Schreiben nur set_gathering_tournaments und delete_gathering (FK set null); Client-Rollen nie (Trigger tournaments_protect_gathering_id, INSERT immer NULL). Aendert weder version noch change_revision.';

CREATE OR REPLACE FUNCTION public.tournaments_protect_gathering_id() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;   -- Server-Funktionen (SECURITY DEFINER), FK-Aktion beim Loeschen der Veranstaltung, Migrationen
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.gathering_id := NULL;   -- @VA-020: Kopie, Import und Abgleich gehoeren zu keiner Veranstaltung
    RETURN NEW;
  END IF;
  IF NEW.gathering_id IS DISTINCT FROM OLD.gathering_id THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: die Zuordnung zur Veranstaltung aendert nur der Server (Turnier %).', OLD.id
      USING ERRCODE = 'HF006';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_protect_gathering_id() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS tournaments_protect_gathering_id ON public.tournaments;
CREATE TRIGGER tournaments_protect_gathering_id BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.tournaments_protect_gathering_id();

-- Papierkorb, Zurueckholen und endgueltiges Loeschen eines zugeordneten Turniers: Version der Veranstaltung steigt (@ZM-180).
CREATE OR REPLACE FUNCTION public.tournaments_touch_gathering() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.gatherings SET updated_at = now() WHERE id = OLD.gathering_id;
    RETURN OLD;
  END IF;
  UPDATE public.gatherings SET updated_at = now() WHERE id IN (OLD.gathering_id, NEW.gathering_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_touch_gathering() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS tournaments_touch_gathering_trash ON public.tournaments;
CREATE TRIGGER tournaments_touch_gathering_trash AFTER UPDATE OF deleted_at ON public.tournaments
  FOR EACH ROW WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
                     AND coalesce(OLD.gathering_id, NEW.gathering_id) IS NOT NULL)
  EXECUTE FUNCTION public.tournaments_touch_gathering();
DROP TRIGGER IF EXISTS tournaments_touch_gathering_delete ON public.tournaments;
CREATE TRIGGER tournaments_touch_gathering_delete AFTER DELETE ON public.tournaments
  FOR EACH ROW WHEN (OLD.gathering_id IS NOT NULL)
  EXECUTE FUNCTION public.tournaments_touch_gathering();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Abschluss-Sperre: Fassung 20261113_003 woertlich, c_free um gathering_id erweitert
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournaments_guard_lifecycle() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  -- 20261119_001 (@VA-019, @VA-015): gathering_id frei -- Zuordnen, Loesen und Loeschen der Veranstaltung auch nach dem Abschluss.
  c_free constant text[] := ARRAY['is_public', 'share_code', 'share_code_created_at', 'version', 'updated_at',
                                  'change_revision', 'owner_id', 'config', 'gathering_id'];
  v_switch boolean := coalesce(current_setting('app.lifecycle_write', true), '') = 'on'
                      AND current_user NOT IN ('authenticated', 'anon');
  v_skip   text[];
BEGIN
  -- W3: Client-Rollen setzen status nur auf 'draft' oder 'published' (completed/live/archived schließen nichts mehr).
  IF current_user IN ('authenticated', 'anon') AND NEW.status NOT IN ('draft', 'published')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Nicht erlaubt: status % setzt nur der Server (Turnier %).', NEW.status, NEW.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.lifecycle_status := 'draft';
    NEW.finished_at := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.lifecycle_status, NEW.finished_at) IS DISTINCT FROM (OLD.lifecycle_status, OLD.finished_at) AND NOT v_switch THEN
    RAISE EXCEPTION 'Nicht erlaubt: den Turnier-Zustand setzt nur der Server (Turnier %).', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.lifecycle_status IN ('finished', 'cancelled') AND NOT v_switch THEN
    -- standingDecisions hält tournaments_keep_standing_decisions für Client-Rollen ohnehin auf dem Serverwert.
    v_skip := CASE WHEN current_user IN ('authenticated', 'anon') THEN ARRAY['publicScorers', 'standingDecisions']
                   ELSE ARRAY['publicScorers'] END;
    IF to_jsonb(NEW) - c_free IS DISTINCT FROM to_jsonb(OLD) - c_free
       OR coalesce(NEW.config, '{}'::jsonb) - v_skip IS DISTINCT FROM coalesce(OLD.config, '{}'::jsonb) - v_skip THEN
      RAISE EXCEPTION 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (Turnier %).', OLD.id USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_guard_lifecycle() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5a. Rechte der Veranstaltung (A1: nur der Eigentuemer mit echtem Konto; Mitglieder mit R1)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_gathering_permission(p_gathering_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_permission IN ('readGathering', 'editGathering', 'deleteGathering', 'assignTournaments',
                          'manageGatheringHelpers', 'manageGatheringMembers', 'useClubs', 'createClubs', 'manageClubs')
     AND public.is_real_account()
     AND EXISTS (SELECT 1 FROM public.gatherings g
                  WHERE g.id = p_gathering_id AND g.owner_id = (SELECT auth.uid()));
$$;
COMMENT ON FUNCTION public.has_gathering_permission(uuid, text) IS
  '20261119_001 (A1, @VA-011): Rechtepruefung der Veranstaltung. A1: wahr nur fuer den Eigentuemer mit echtem Konto und einen der festen Rechte-Namen; Mitglieder (gathering_members) kommen mit R1.';

-- Name pruefen (HF010): 1-80 Zeichen nach btrim, ohne Steuer- und Formatzeichen (wie tournament_join_requests.display_name).
CREATE OR REPLACE FUNCTION public.gathering_name_or_fail(p_name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF char_length(v_name) NOT BETWEEN 1 AND 80
     OR v_name ~ '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]' THEN
    RAISE EXCEPTION 'GATHERING_NAME_INVALID: Name leer, laenger als 80 Zeichen oder mit Steuerzeichen.' USING ERRCODE = 'HF010';
  END IF;
  RETURN v_name;
END;
$$;
REVOKE ALL ON FUNCTION public.gathering_name_or_fail(text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5b. Verwaltung (@VA-015, @VA-016, @VA-011, @VA-021)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_gathering(p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_per_account constant integer := 50;
  v_uid uuid := (SELECT auth.uid());
  v_name text;
  v_code text;
  v_id uuid;
  v_attempt integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_real_account() THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: eine Veranstaltung legt nur ein echtes Konto an.' USING ERRCODE = 'HF006';
  END IF;
  v_name := public.gathering_name_or_fail(p_name);
  -- Obergrenze je Konto: gleichzeitige Aufrufe desselben Kontos warten aufeinander.
  PERFORM pg_advisory_xact_lock(hashtextextended('gatherings:' || v_uid::text, 0));
  IF (SELECT count(*) FROM public.gatherings g WHERE g.owner_id = v_uid) >= c_max_per_account THEN
    RAISE EXCEPTION 'GATHERING_LIMIT: hoechstens % Veranstaltungen je Konto.', c_max_per_account USING ERRCODE = 'HF009';
  END IF;
  LOOP
    v_attempt := v_attempt + 1;
    v_code := public.generate_share_code();
    -- Ein Code kommt ueber alle Tabellen mit oeffentlichem Code hoechstens einmal vor (GATE 2 Nr. 15). Eine spaetere Ebene
    -- (z. B. Turnierserie /serie/<Code>) ergaenzt hier ein weiteres NOT EXISTS.
    IF NOT EXISTS (SELECT 1 FROM public.gatherings g WHERE g.share_code = v_code)
       AND NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.share_code = v_code) THEN
      BEGIN
        INSERT INTO public.gatherings (owner_id, name, share_code) VALUES (v_uid, v_name, v_code) RETURNING id INTO v_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        NULL;   -- gleichzeitig vergeben: naechster Versuch
      END;
    END IF;
    IF v_attempt >= 20 THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', v_attempt;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('id', v_id, 'share_code', v_code);
END;
$$;
COMMENT ON FUNCTION public.create_gathering(text) IS
  '20261119_001 (@VA-015): legt eine Veranstaltung an (Aufrufer = Eigentuemer, nur echtes Konto, hoechstens 50 je Konto) und erzeugt den Code; Antwort {id, share_code}. Fehler HF006, HF009, HF010.';

CREATE OR REPLACE FUNCTION public.rename_gathering(p_gathering_id uuid, p_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gatherings g WHERE g.id = p_gathering_id) THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF008';
  END IF;
  IF NOT public.has_gathering_permission(p_gathering_id, 'editGathering') THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF006';
  END IF;
  v_name := public.gathering_name_or_fail(p_name);
  UPDATE public.gatherings SET name = v_name WHERE id = p_gathering_id;
END;
$$;
COMMENT ON FUNCTION public.rename_gathering(uuid, text) IS
  '20261119_001 (@VA-015 Z. 2): neuer Name, Code und Link bleiben. Recht editGathering. Fehler HF006, HF008, HF010.';

CREATE OR REPLACE FUNCTION public.delete_gathering(p_gathering_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.gatherings g WHERE g.id = p_gathering_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF008';
  END IF;
  IF NOT public.has_gathering_permission(p_gathering_id, 'deleteGathering') THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF006';
  END IF;
  -- Turniere bleiben, gathering_id wird NULL (FK; geht wegen c_free auch bei abgeschlossenen Turnieren); Mitglieder fallen weg.
  DELETE FROM public.gatherings WHERE id = p_gathering_id;
END;
$$;
COMMENT ON FUNCTION public.delete_gathering(uuid) IS
  '20261119_001 (@VA-015 Z. 3): loescht endgueltig; Turniere bleiben ohne Veranstaltung, sonst unveraendert. Recht deleteGathering. Fehler HF006, HF008.';

CREATE OR REPLACE FUNCTION public.set_gathering_tournaments(p_gathering_id uuid, p_add uuid[], p_remove uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_per_gathering constant integer := 50;
  v_owner uuid;
  v_add uuid[] := coalesce(p_add, '{}'::uuid[]);
  v_remove uuid[] := coalesce(p_remove, '{}'::uuid[]);
  v_added integer;
  v_removed integer;
  r record;
BEGIN
  SELECT g.owner_id INTO v_owner FROM public.gatherings g WHERE g.id = p_gathering_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF008';
  END IF;
  IF NOT public.has_gathering_permission(p_gathering_id, 'assignTournaments') THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF006';
  END IF;
  IF array_position(v_add, NULL) IS NOT NULL OR array_position(v_remove, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Turnier ohne Kennung.' USING ERRCODE = 'HF008';
  END IF;
  IF v_add && v_remove THEN
    RAISE EXCEPTION 'GATHERING_INVALID_INPUT: ein Turnier steht in add und remove.' USING ERRCODE = '22023';
  END IF;
  -- Ganz oder gar nicht: alle betroffenen Turniere sperren (nach id), dann pruefen, dann schreiben (@VA-016).
  PERFORM 1 FROM public.tournaments t WHERE t.id = ANY (v_add || v_remove) ORDER BY t.id FOR UPDATE;
  FOR r IN SELECT a.id, t.id AS found_id, t.owner_id, t.deleted_at, t.gathering_id
             FROM unnest(v_add) AS a(id) LEFT JOIN public.tournaments t ON t.id = a.id LOOP
    IF r.found_id IS NULL OR r.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'GATHERING_NOT_FOUND: Turnier % fehlt oder liegt im Papierkorb.', r.id USING ERRCODE = 'HF008';
    END IF;
    IF r.owner_id IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Turnier % gehoert einem anderen Konto.', r.id USING ERRCODE = 'HF006';
    END IF;
    IF r.gathering_id IS NOT NULL AND r.gathering_id <> p_gathering_id THEN
      RAISE EXCEPTION 'GATHERING_CONFLICT: Turnier % gehoert schon zu einer anderen Veranstaltung.', r.id USING ERRCODE = 'HF007';
    END IF;
  END LOOP;
  -- Wiederholbar: schon zugeordnet bzw. nicht zugeordnet aendert nichts und ist kein Fehler. version/change_revision bleiben.
  UPDATE public.tournaments t SET gathering_id = p_gathering_id
   WHERE t.id = ANY (v_add) AND t.gathering_id IS NULL;
  GET DIAGNOSTICS v_added = ROW_COUNT;
  UPDATE public.tournaments t SET gathering_id = NULL
   WHERE t.id = ANY (v_remove) AND t.gathering_id = p_gathering_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  -- Obergrenze je Veranstaltung (public_gathering ist fuer anon aufrufbar und rechnet je Turnier); ganz oder gar nicht.
  IF (SELECT count(*) FROM public.tournaments t WHERE t.gathering_id = p_gathering_id) > c_max_per_gathering THEN
    RAISE EXCEPTION 'GATHERING_TOO_MANY: hoechstens % Turniere je Veranstaltung.', c_max_per_gathering USING ERRCODE = 'HF011';
  END IF;
  -- Monotone Version: ein geloestes Turnier faellt aus dem Maximum, die Veranstaltung traegt den Zeitpunkt (@ZM-180).
  UPDATE public.gatherings SET updated_at = now() WHERE id = p_gathering_id;
  RETURN jsonb_build_object('added', v_added, 'removed', v_removed);
END;
$$;
COMMENT ON FUNCTION public.set_gathering_tournaments(uuid, uuid[], uuid[]) IS
  '20261119_001 (@VA-016, @VA-019, @VA-021): ordnet Turniere zu bzw. loest sie, ganz oder gar nicht, wiederholbar; nur Turniere des Eigentuemers der Veranstaltung, nicht im Papierkorb, hoechstens eine Veranstaltung je Turnier; abgeschlossene erlaubt. Recht assignTournaments. Antwort {added, removed}. Hoechstens 50 Turniere je Veranstaltung. Fehler HF006, HF007, HF008, HF011, 22023.';

-- ---------------------------------------------------------------------------------------------------------------
-- 5c. Oeffentlicher Abruf (@VA-001 bis @VA-004, @VA-006, @VA-012, @VA-014; Positivliste)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_gathering(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_lag_us constant bigint := 5000000;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_now_us bigint := floor(extract(epoch FROM now()) * 1000000)::bigint;
  v_server_now bigint := floor(extract(epoch FROM now()) * 1000)::bigint;
  v_g public.gatherings;
  v_list jsonb;
  v_assigned integer;
  v_upcoming boolean;
  v_max timestamptz;
  v_version bigint;
BEGIN
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  SELECT * INTO v_g FROM public.gatherings g WHERE g.share_code = v_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  WITH ts AS (
    SELECT t.id, t.title, t.date, t.start_time, t.location_name, t.is_public, t.share_code, t.lifecycle_status,
           t.updated_at,
           ms.started, ms.first_start, ms.max_actual, ms.max_updated, sc.changed_at,
           coalesce((SELECT bool_and(m.match_status IN ('running', 'paused', 'finished') OR m.skipped_at IS NOT NULL)
                       FROM public.matches m
                      WHERE m.tournament_id = t.id
                        AND m.scheduled_start = (SELECT max(m2.scheduled_start) FROM public.matches m2
                                                  WHERE m2.tournament_id = t.id)), false) AS last_started
      FROM public.tournaments t
      LEFT JOIN LATERAL (
        SELECT coalesce(bool_or(m.match_status IN ('running', 'paused', 'finished')), false) AS started,
               min(m.scheduled_start) AS first_start, max(m.actual_start) AS max_actual, max(m.updated_at) AS max_updated
          FROM public.matches m WHERE m.tournament_id = t.id) AS ms ON true
      LEFT JOIN public_view.structure_changes sc ON sc.tournament_id = t.id
     WHERE t.gathering_id = v_g.id AND t.deleted_at IS NULL
  ), st AS (
    SELECT ts.*,
           CASE WHEN ts.lifecycle_status = 'cancelled' THEN 'cancelled'
                WHEN ts.lifecycle_status = 'finished' THEN 'finished'
                WHEN ts.started AND v_today >= ts.date + 2 THEN 'finished'   -- gekappt (wie @HE-111)
                WHEN ts.started THEN 'live'
                ELSE 'planned' END AS state
      FROM ts
  )
  SELECT (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'title', s.title, 'date', s.date, 'begin', coalesce(s.first_start, s.start_time),
                    'location_name', s.location_name, 'state', s.state, 'last_match_started', s.last_started,
                    'share_code', s.share_code))
                  ORDER BY s.date, coalesce(s.first_start, s.start_time) NULLS LAST, s.title, s.id), '[]'::jsonb)
            FROM st s WHERE coalesce(s.is_public, false)),
         (SELECT count(*) FROM st),
         (SELECT coalesce(bool_or(s.state = 'planned' AND s.date >= v_today), false) FROM st s),
         (SELECT max(x) FROM st s
            CROSS JOIN LATERAL (VALUES (s.updated_at), (s.max_actual), (s.max_updated), (s.changed_at)) AS v(x))
    INTO v_list, v_assigned, v_upcoming, v_max;

  v_max := greatest(v_g.updated_at, v_max);
  v_version := greatest(least(floor(extract(epoch FROM v_max) * 1000000)::bigint, v_now_us - c_lag_us), 0);

  IF jsonb_array_length(v_list) > 0 THEN
    RETURN jsonb_build_object('state', 'full', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name,
                              'tournaments', v_list);
  END IF;
  IF v_assigned = 0 OR v_upcoming THEN
    RETURN jsonb_build_object('state', 'pending', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name);
  END IF;
  RETURN jsonb_build_object('state', 'not_found');
END;
$$;
COMMENT ON FUNCTION public.public_gathering(text) IS
  '20261119_001 (A1): oeffentliche Seite der Veranstaltung. {state:not_found} | {state:pending, version, server_now, name} | {state:full, version, server_now, name, tournaments:[title, date, begin, location_name, state, last_match_started, share_code]}; nur oeffentliche, nicht geloeschte Turniere, keine Teams, Spielstaende, Kontakte oder Anzahlen. Immer Voll-Antwort; version monoton.';

-- ---------------------------------------------------------------------------------------------------------------
-- 5d. Turnierantwort: Fassung 20261117_104 woertlich, nur gathering_code fuer Zuschauer
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public_view.public_payload(p_tournament_id uuid, p_since_version bigint, p_audience text,
                                                     p_monitor_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_lag_us constant bigint := 5000000;
  v_t public.tournaments;
  v_now_us bigint := public_view.epoch_us(now());
  v_server_now bigint := floor(extract(epoch FROM now()) * 1000)::bigint;
  v_tournament_us bigint;
  v_teams_us bigint;
  v_matches_us bigint;
  v_structure_us bigint;
  v_max_us bigint;
  v_version bigint;
  v_full boolean;
  v_sw jsonb;
  v_kids boolean;
  v_rankings boolean;
  v_live boolean;
  v_events boolean;
  v_scorers boolean;
  v_screen boolean := p_audience = 'screen';
  v_referees text;
  v_tournament jsonb;
  v_teams jsonb;
  v_matches jsonb;
  v_result jsonb;
BEGIN
  IF p_audience IS NULL OR p_audience NOT IN ('viewer', 'screen') THEN
    RAISE EXCEPTION 'public_view.public_payload: unbekannte Zielgruppe %', p_audience USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  v_tournament_us := public_view.epoch_us(coalesce(v_t.updated_at, v_t.created_at, '-infinity'::timestamptz));
  SELECT public_view.epoch_us(max(tm.updated_at)) INTO v_teams_us FROM public.teams tm WHERE tm.tournament_id = v_t.id;
  SELECT public_view.epoch_us(max(m.updated_at)) INTO v_matches_us FROM public.matches m WHERE m.tournament_id = v_t.id;
  -- Geloeschte Spiele/Teams (A1): Zeitpunkt der letzten Loeschung aus public_view.structure_changes.
  SELECT public_view.epoch_us(sc.changed_at) INTO v_structure_us
    FROM public_view.structure_changes sc WHERE sc.tournament_id = v_t.id;
  v_max_us := greatest(coalesce(v_tournament_us, 0), coalesce(v_teams_us, 0), coalesce(v_matches_us, 0),
                       coalesce(v_structure_us, 0), 0);
  v_version := greatest(least(v_max_us, v_now_us - c_lag_us), 0);

  IF p_since_version IS NULL OR p_since_version < 0 OR p_since_version > v_version THEN
    v_full := true;
  ELSIF v_max_us <= p_since_version THEN
    RETURN jsonb_build_object('state', 'unchanged', 'version', p_since_version, 'server_now', v_server_now);
  ELSE
    v_full := coalesce(v_tournament_us, 0) > p_since_version OR coalesce(v_teams_us, 0) > p_since_version
              OR coalesce(v_structure_us, 0) > p_since_version;
  END IF;

  v_sw := public_view.switches(v_t.config);
  v_kids := (v_sw ->> 'kidsMode')::boolean;
  v_rankings := NOT v_kids AND (v_sw ->> 'tables')::boolean;
  v_live := NOT v_kids AND (v_sw ->> 'liveScore')::boolean;
  v_events := NOT v_kids AND (v_sw ->> 'events')::boolean;
  v_scorers := NOT v_kids AND (v_sw ->> 'scorers')::boolean;
  -- Schiedsrichter am Bildschirm (@W3-032, Regel 12): config.monitorReferees 'number' (Vorgabe) | 'name' | 'none'.
  v_referees := CASE WHEN NOT v_screen THEN 'none'
                     WHEN v_t.config ->> 'monitorReferees' IN ('name', 'none') THEN v_t.config ->> 'monitorReferees'
                     ELSE 'number' END;

  -- Spiele (alle oder nur die seither geaenderten).
  SELECT coalesce(jsonb_agg(row_json ORDER BY sort_number NULLS LAST, sort_id), '[]'::jsonb) INTO v_matches
    FROM (
      SELECT m.match_number AS sort_number, m.id AS sort_id,
             public_view.without_nulls(jsonb_build_object(
               'id', m.id, 'match_number', m.match_number, 'round', m.round, 'field', m.field, 'slot', m.slot,
               'phase', m.phase, 'group_letter', m.group_letter,
               'slot_a_source', public_view.side_source(m.slot_a_source, m.team_a_id IS NOT NULL, v_rankings),
               'slot_b_source', public_view.side_source(m.slot_b_source, m.team_b_id IS NOT NULL, v_rankings),
               'origin_a', public_view.side_source(jm.j -> 'origin_a', true, v_rankings),
               'origin_b', public_view.side_source(jm.j -> 'origin_b', true, v_rankings),
               'is_final', m.is_final, 'final_type', m.final_type, 'label', m.label,
               'scheduled_start', m.scheduled_start, 'original_start', m.original_start,
               'match_status', m.match_status,
               'live_state', public_view.live_state_for(m.live_state, v_kids), 'timer_start_time', m.timer_start_time,
               'timer_paused_at', m.timer_paused_at, 'timer_elapsed_seconds', m.timer_elapsed_seconds,
               'actual_start', m.actual_start, 'actual_end', m.actual_end, 'skipped_at', m.skipped_at,
               'kit_color_a', jm.j -> 'kit_color_a', 'kit_color_b', jm.j -> 'kit_color_b', 'bib_side', jm.j -> 'bib_side',
               'score_a', CASE WHEN vis.scores THEN m.score_a END,
               'score_b', CASE WHEN vis.scores THEN m.score_b END,
               'overtime_score_a', CASE WHEN vis.scores THEN m.overtime_score_a END,
               'overtime_score_b', CASE WHEN vis.scores THEN m.overtime_score_b END,
               'penalty_score_a', CASE WHEN vis.scores THEN m.penalty_score_a END,
               'penalty_score_b', CASE WHEN vis.scores THEN m.penalty_score_b END,
               'decided_by', CASE WHEN NOT v_kids THEN m.decided_by END,
               'forfeit_absent', CASE WHEN NOT v_kids THEN jm.j -> 'forfeit_absent' END,
               'referee_number', CASE WHEN v_referees <> 'none' THEN m.referee_number END))
             -- Seiten immer mit Schluessel (der Client unterscheidet "kein Team" = null von "fehlt").
             || jsonb_build_object('team_a_id', m.team_a_id, 'team_b_id', m.team_b_id)
             || CASE WHEN ev.list = '[]'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('events', ev.list) END
             AS row_json
        FROM public.matches m
        -- Spalten spaeterer Pakete (origin_x A-36a, kit_* A-30a, forfeit_absent A-25) ueber die Zeile als JSON: fehlt eine
        -- Spalte, fehlt nur ihr Schluessel (keine Abhaengigkeit von der Einspiel-Reihenfolge).
        CROSS JOIN LATERAL (SELECT to_jsonb(m) AS j) AS jm
        CROSS JOIN LATERAL (
          SELECT NOT v_kids AND (m.match_status IS NULL OR m.match_status NOT IN ('running', 'paused') OR v_live)
                 AS scores) AS vis
        CROSS JOIN LATERAL (
          SELECT CASE WHEN v_kids OR NOT (v_events OR vis.scores) THEN '[]'::jsonb
                      ELSE public_view.match_events(m.id, vis.scores AND v_events, v_events, vis.scores, v_events)
                 END AS list) AS ev
       WHERE m.tournament_id = v_t.id
         AND (v_full OR public_view.epoch_us(m.updated_at) > p_since_version)
    ) AS r;

  -- Voll-Antwort: die eigene Version (auch wenn since voraus war, N5); Delta: nie kleiner als since.
  v_result := jsonb_build_object('version', CASE WHEN v_full THEN v_version ELSE greatest(v_version, p_since_version) END,
                                 'server_now', v_server_now);

  -- Torschuetzen-Zwischenstand (@ZM-099, @ZM-102): nur mit Schalter, aus Toren mit Nummer in Spielen, deren Stand
  -- oeffentlich ist; Eigentore zaehlen fuer keinen Schuetzen.
  IF v_scorers THEN
    v_result := v_result || jsonb_build_object('scorers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('team_id', g.team_id, 'number', g.number, 'goals', g.goals)
                                ORDER BY g.goals DESC, g.team_id, g.number), '[]'::jsonb)
        FROM (
          SELECT (e ->> 'team_id')::uuid AS team_id, (e -> 'number') AS number, count(*) AS goals
            FROM public.matches m
            CROSS JOIN LATERAL jsonb_array_elements(public_view.match_events(m.id, true, false, false, true)) AS x(e)
           WHERE m.tournament_id = v_t.id
             AND (m.match_status IS NULL OR m.match_status NOT IN ('running', 'paused') OR v_live)
             AND e ->> 'type' = 'GOAL' AND e ? 'number'
           GROUP BY 1, 2) AS g));
  END IF;

  IF NOT v_full THEN
    RETURN v_result || jsonb_build_object('state', 'delta', 'base_version', p_since_version,
                                          'tournament_date', v_t.date, 'matches', v_matches);
  END IF;

  v_tournament := public_view.without_nulls(jsonb_build_object(
      'id', v_t.id, 'title', v_t.title, 'date', v_t.date, 'start_time', v_t.start_time, 'sport', v_t.sport,
      'tournament_type', v_t.tournament_type, 'status', v_t.status,
      'location_name', v_t.location_name, 'location_street', v_t.location_street,
      'location_city', v_t.location_city, 'location_postal_code', v_t.location_postal_code,
      'location_country', v_t.location_country,
      'number_of_fields', v_t.number_of_fields, 'number_of_teams', v_t.number_of_teams,
      'number_of_groups', v_t.number_of_groups, 'group_phase_duration', v_t.group_phase_duration,
      'group_phase_break', v_t.group_phase_break, 'final_round_duration', v_t.final_round_duration,
      'final_round_break', v_t.final_round_break, 'point_system', v_t.point_system,
      'finals_config', v_t.finals_config,
      'referee_config', CASE WHEN v_referees = 'name' THEN v_t.referee_config
                             WHEN v_referees = 'number' AND jsonb_typeof(v_t.referee_config) = 'object'
                               THEN v_t.referee_config - 'refereeNames' END,
      'is_public', coalesce(v_t.is_public, false),
      'share_code', CASE WHEN coalesce(v_t.is_public, false) THEN v_t.share_code END,
      -- 20261119_001 (@VA-013, @VA-014): Code der Veranstaltung nur fuer Zuschauer, nur oeffentlich und zugeordnet.
      'gathering_code', CASE WHEN NOT v_screen AND coalesce(v_t.is_public, false) AND v_t.gathering_id IS NOT NULL
                               THEN (SELECT g.share_code FROM public.gatherings g WHERE g.id = v_t.gathering_id) END,
      'completed_at', v_t.completed_at,
      'lifecycle_status', to_jsonb(v_t) -> 'lifecycle_status',
      'finished_at', to_jsonb(v_t) -> 'finished_at',
      'config', public_view.config_for(v_t.config, p_audience, p_monitor_id, v_rankings)));

  SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
           'id', tm.id, 'name', tm.name, 'group_letter', tm.group_letter, 'is_removed', tm.is_removed,
           'logo_path', tm.logo_path, 'logo_background_color', tm.logo_background_color,
           'color_primary', tm.color_primary, 'color_secondary', tm.color_secondary))
           ORDER BY tm.sort_order NULLS LAST, tm.name, tm.id), '[]'::jsonb)
    INTO v_teams
    FROM public.teams tm
   WHERE tm.tournament_id = v_t.id;

  RETURN v_result || jsonb_build_object('state', 'full', 'tournament', v_tournament, 'teams', v_teams,
                                        'matches', v_matches);
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public_view FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Rechte
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.gatherings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gathering_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gatherings, public.gathering_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gatherings TO authenticated;
GRANT SELECT ON public.gatherings, public.gathering_members TO ci_schema_reader;   -- nur pg_dump; RLS: 0 Zeilen

DROP POLICY IF EXISTS gatherings_select ON public.gatherings;
CREATE POLICY gatherings_select ON public.gatherings FOR SELECT TO authenticated
  USING (public.has_gathering_permission(id, 'readGathering'));

REVOKE ALL ON FUNCTION public.has_gathering_permission(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_gathering_permission(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_gathering(text), public.rename_gathering(uuid, text), public.delete_gathering(uuid),
                       public.set_gathering_tournaments(uuid, uuid[], uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_gathering(text), public.rename_gathering(uuid, text), public.delete_gathering(uuid),
                          public.set_gathering_tournaments(uuid, uuid[], uuid[])
  TO authenticated;
REVOKE ALL ON FUNCTION public.public_gathering(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_gathering(text) TO anon, authenticated, service_role;

COMMIT;
