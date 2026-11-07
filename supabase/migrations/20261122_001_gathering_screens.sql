-- supabase/migrations/20261122_001_gathering_screens.sql
-- Hinweis: Der Stempel "20261120_002" im Rumpf von public_gathering (Kommentar zu @VA-045) bleibt bewusst alt -- die Fassung
-- ist ueber md5 6a9e35279f99c527341c85fce26af03a festgelegt (Fail-fast hier, Rueckweg, Harness); Umnummerierung 20261120_002 -> 20261122_001.
-- A1b Monitore der Veranstaltung - Daten und Server (Record docs/anforderungen/2026-11-06_veranstaltung-mehrere-turniere.md,
-- Funktionalitaet G; Umsetzungsvorgabe A1b vom 06.11. mit den Entscheidungen des Controllers, gilt nach Vorschlag).
-- Die Turnierleitung macht mit "Auf die Bildschirme" ein Turnier zum Turnier in der Halle; die Bildschirme der Veranstaltung
-- (eigene Adresse mit geheimem Schluessel je Bildschirm, der "Hallen-Link") zeigen nur dieses, und "Jetzt in der Halle" fuer
-- Zuschauer folgt demselben Schalter.
-- Szenarien (Server): @VA-034 bis @VA-041, @VA-043, @VA-044, @VA-045 bis @VA-047, Pruefregel @ZM-180 (monotone Version ueber
--   die echte Antwort, auch ueber einen Wechsel des Turniers hinweg).
--   @VA-042: Server-Teil BEWUSST NICHT (Controller 06.11.): display_tournament und display_final_standings bleiben Byte fuer
--   Byte gleich; ein Fernseher oeffnet genau eine Adresse, die Exklusivitaet regelt die App (A7). Der Server merkt sich nur,
--   aus welchem Turnier-Monitor ein Bildschirm uebernommen wurde (adopted_*), damit die App ihn als ersetzt zeigen kann.
--
-- Inhalt:
--   1. gatherings: on_screen_tournament_id, on_screen_since, screen_location_name. Clients schreiben gatherings nie (A1: keine
--      Schreibrechte); jede Aenderung setzt ueber gatherings_updated_at auch updated_at. Bewusst OHNE Fremdschluessel auf
--      tournaments (auch adopted_tournament_id): die Veranstaltung haengt nicht am Turnier, sonst fielen gatherings und ihre
--      Tabellen unter die Abschluss-Sperre (Assertion lifecycle-guard-triggers-complete); endgueltiges Loeschen raeumt der
--      Trigger tournaments_clear_on_screen_delete ab.
--   2. Tabelle gathering_screens (RLS an, keine Policy, keine Tabellenrechte fuer Clients): Name, Schluessel (32 Hex-Zeichen,
--      128 Bit aus extensions.gen_random_bytes, im Klartext, lesbar nur ueber gathering_screens_overview des Eigentuemers),
--      Folien-Konfiguration (config, Monitor-Fassung) und Sponsoren je Bildschirm, Herkunft adopted_*; hoechstens 10 je
--      Veranstaltung.
--   3. Zulaessigkeit an EINER Stelle: gathering_screen_reason(gathering, turnier) -> NULL oder Grund (not_found,
--      not_in_gathering, trashed, cancelled, draft, no_screens, no_location, other_location). Ort normalisiert verglichen
--      (gathering_location_key: Gross/Klein, Raender, mehrfache Leerzeichen); Turnier ohne Ort nie zulaessig.
--   4. Trigger tournaments_clear_on_screen (AFTER UPDATE, ohne Spaltenliste: auch was ein BEFORE-Trigger aendert, etwa
--      lifecycle_status beim Zuruecksetzen auf Entwurf) und tournaments_clear_on_screen_delete: wird das Turnier in der Halle
--      unzulaessig (geloest, Papierkorb, Entwurf, Ort, endgueltig geloescht), steht es nicht mehr auf den Bildschirmen -- es
--      kommt nie still zurueck ("wechselt nie still").
--   5. Funktionen: create_/update_/delete_gathering_screen, rotate_gathering_screen_key, adopt_tournament_monitor,
--      set_gathering_screen_location (editGathering, im MVP nur der Eigentuemer, E8); set_gathering_on_screen und
--      gathering_screen_status (manageScreens am Turnier: Eigentuemer mit Konto, Co-Admin; nicht Helfer, nicht Bildschirm);
--      gathering_screens_overview (readGathering); gathering_screen_display und gathering_screen_final_standings (anon, per
--      Schluessel); public_gathering = Fassung 20261119_001 woertlich + on_screen (Hilfe gathering_public_on_screen).
--   6. Rechte: REVOKE ALL auf gathering_screens fuer PUBLIC, anon, authenticated; SELECT fuer ci_schema_reader.
--
-- Lesarten (Umsetzungsvorgabe A1b, gilt nach Vorschlag):
--   Zulaessig fuer die Bildschirme: zugeordnet, nicht im Papierkorb, lifecycle_status 'fixed' (Bereit/Laeuft) oder
--   'finished' (Abgeschlossen), die Veranstaltung hat Bildschirme und einen Ort, das Turnier denselben Ort. Nicht geteilte
--   Turniere sind zulaessig (Halle ist nicht Internet); Zuschauer sehen sie nicht (on_screen fehlt in public_gathering).
--   "Auf die Bildschirme" ist kein Anpfiff: das Turnier steht auch ohne angepfiffenes Spiel in der Halle (@VA-035).
--   Letzter Tipp gilt (@VA-038): set_gathering_on_screen sperrt die Veranstaltung FOR UPDATE. "Von den Bildschirmen nehmen"
--   nimmt nur genau dieses Turnier herunter; steht schon ein anderes dort, aendert sich nichts.
--   gathering_screen_display(key, since): {state:'invalid'} (Format, unbekannt, erneuert, geloescht -- kein Orakel; ein
--   oeffentlicher Code hat nie das Schluessel-Format, @VA-043) | {state:'unchanged', version, server_now} |
--   {state:'gathering', version, server_now, screen, sponsors, gathering:{name, share_code}, tournaments:[{title, date, begin,
--   state, last_match_started}]} (Folie der Veranstaltung; alle zulaessigen Turniere, auch nicht geteilte) |
--   {state:'tournament', version, server_now, on_screen:{tournament_id, since}[, gathering, screen, sponsors], payload}
--   (payload = public_view.public_payload(turnier, since, 'screen', NULL) ohne version/server_now, also Monitor-Fassung mit
--   Kindermodus und Schaltern des Turniers, ohne dessen Monitore und Sponsoren; gathering/screen/sponsors nur bei voller
--   Antwort).
--   version = Mikrosekunden von greatest(gatherings.updated_at, gathering_screens.updated_at, je zugeordnetem, nicht
--   geloeschtem Turnier: tournaments.updated_at, max(teams.updated_at), max(matches.updated_at),
--   structure_changes.changed_at), hoechstens "jetzt - 5 s" (c_lag_us). Ein Wechsel setzt gatherings.updated_at, deshalb
--   liegt jede Antwort danach ueber jeder davor -- auch beim Rueckwechsel auf ein laenger unveraendertes Turnier (@ZM-180).
--   Mit gueltigem since (0 <= since <= version): nichts fuer diesen Bildschirm Relevantes neuer als since -> unchanged;
--   Turnier in der Halle und weder Veranstaltung noch Bildschirm neuer als since -> Delta ueber public_payload(since) (dann
--   gilt since < innere Version, nie "voll, weil voraus"); sonst voll.
--   public_gathering.on_screen: {share_code, title, live_matches:[{match_number, field, status, score_a, score_b}]} nur mit
--   Bildschirmen, zulaessigem und oeffentlichem Turnier in der Halle; Spielstand nur ohne Kindermodus und mit Live-Stand.
--
-- Fehlercodes (Projektmuster HF0xx, nie PTxxx; HF012-HF015 fuer A1b reserviert):
--   HF006 GATHERING_NOT_ALLOWED (wie A1: Recht fehlt, kein echtes Konto, Turnier eines anderen Kontos) |
--   HF008 GATHERING_NOT_FOUND (Veranstaltung, Bildschirm, Turnier oder Monitor fehlt, Turnier im Papierkorb) |
--   HF010 GATHERING_NAME_INVALID (Name des Bildschirms oder Ort; Pruefung gathering_name_or_fail aus 20261119_001) |
--   HF012 GATHERING_SCREEN_NOT_ELIGIBLE (Grund im Text) | HF013 GATHERING_SCREEN_LIMIT (mehr als 10 Bildschirme) |
--   HF014 GATHERING_SCREEN_CONFIG_INVALID (config kein Objekt, slides kein Array, sponsors kein Array von Objekten, ueber
--   1 MiB) | HF015 GATHERING_SCREEN_TAKEN (Monitor des Turniers schon uebernommen) | 22023 (p_on fehlt).
--
-- Zeichen: diese Datei ist rein ASCII und enthaelt kein Unicode-Escape mit Backslash (Namen und Ort pruefen ueber gathering_name_or_fail aus 20261119_001).
-- Bestandsdaten: keine Aenderung; alle Veranstaltungen starten ohne Bildschirme und ohne Turnier in der Halle; die Antwort
--   von public_gathering bleibt dann Byte fuer Byte gleich. Kein Backfill.
-- Voraussetzungen (Fail-fast unten): 20261119_001 (gatherings, has_gathering_permission, gathering_name_or_fail,
--   public_gathering in der Fassung 20261119_001 oder dieser Datei), 20261117_104 (public_view), 20261113_003 und
--   20261118_004 (final_standings_payload, tournament_final_standings), 20261110_001 (manageScreens), pgcrypto,
--   ci_schema_reader.
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS vor
--   CREATE, REVOKE/GRANT.
--
-- RUECKWEG: supabase/rollbacks/20261122_001_gathering_screens_rollback.sql, EIN Block (public_gathering woertlich aus
--   20261119_001 zurueck, Funktionen, Trigger, Tabelle und Spalten weg). Vorher die App ohne A7-Client deployen.
--   Bildschirme und das Turnier in der Halle gehen verloren (vorher per COPY sichern). Belegt in
--   scripts/gathering-screens-check.sh (Kategorie X: Schema danach = vorher).
--
-- Produktion: nur nach Daniels Freigabe (Freigabe-Unterlage A1b mit SQL und SHA-256) durch den Controller. Dieser Branch
-- spielt nichts ein. Typen neu (src/types/supabase.ts).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_pg text;
BEGIN
  IF to_regclass('public.gatherings') IS NULL
     OR to_regprocedure('public.has_gathering_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.gathering_name_or_fail(text)') IS NULL
     OR to_regprocedure('public.public_gathering(text)') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.is_real_account()') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('public_view.public_payload(uuid,bigint,text,text)') IS NULL
     OR to_regprocedure('public_view.switches(jsonb)') IS NULL
     OR to_regprocedure('public_view.epoch_us(timestamptz)') IS NULL
     OR to_regprocedure('public_view.without_nulls(jsonb)') IS NULL
     OR to_regclass('public_view.structure_changes') IS NULL
     OR to_regprocedure('match_engine.final_standings_payload(public.tournaments)') IS NULL
     OR to_regclass('public.tournament_final_standings') IS NULL
     OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'co-admin' AND permission = 'manageScreens') THEN
    RAISE EXCEPTION '20261122_001_gathering_screens: Voraussetzungen fehlen -- zuerst 20261110_001, 20261117_104, 20261118_004 und 20261119_001 einspielen (pgcrypto, ci_schema_reader)';
  END IF;
  -- Nie still eine andere Fassung ueberschreiben: public_gathering aus 20261119_001 oder genau die Fassung dieser Datei.
  SELECT prosrc INTO v_pg FROM pg_proc WHERE oid = 'public.public_gathering(text)'::regprocedure;
  IF md5(v_pg) NOT IN ('b1e18d7eaf2714409eba33103ac47915', '6a9e35279f99c527341c85fce26af03a') THEN
    RAISE EXCEPTION '20261122_001_gathering_screens: public_gathering hat eine unbekannte Fassung (md5 %) -- erst klaeren', md5(v_pg);
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. gatherings: Turnier in der Halle und Ort der Bildschirme (nur der Server schreibt)
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.gatherings
  ADD COLUMN IF NOT EXISTS on_screen_tournament_id uuid,
  ADD COLUMN IF NOT EXISTS on_screen_since timestamptz,
  ADD COLUMN IF NOT EXISTS screen_location_name text;
COMMENT ON COLUMN public.gatherings.on_screen_tournament_id IS
  '20261122_001 (A1b, @VA-035): Turnier in der Halle. Schreiben nur set_gathering_on_screen und die Trigger/Funktionen dieser Migration; zaehlt nur, solange gathering_screen_reason NULL ist.';
COMMENT ON COLUMN public.gatherings.on_screen_since IS
  '20261122_001 (A1b): Zeitpunkt des letzten Wechsels auf bzw. von den Bildschirmen.';
COMMENT ON COLUMN public.gatherings.screen_location_name IS
  '20261122_001 (A1b, @VA-041): Ort der Bildschirme; verglichen ueber gathering_location_key. NULL = noch kein Ort, keine Umschaltung.';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Tabelle gathering_screens
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gathering_screens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id          uuid NOT NULL REFERENCES public.gatherings(id) ON DELETE CASCADE,
  name                  text NOT NULL CONSTRAINT gathering_screens_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  screen_key            text NOT NULL CONSTRAINT gathering_screens_key_format CHECK (screen_key ~ '^[0-9a-f]{32}$'),
  key_created_at        timestamptz NOT NULL DEFAULT now(),
  config                jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT gathering_screens_config_object CHECK (jsonb_typeof(config) = 'object'),
  sponsors              jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT gathering_screens_sponsors_array CHECK (jsonb_typeof(sponsors) = 'array'),
  adopted_tournament_id uuid,
  adopted_monitor_id    text CONSTRAINT gathering_screens_adopted_monitor_length CHECK (adopted_monitor_id IS NULL OR char_length(adopted_monitor_id) BETWEEN 1 AND 100),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gathering_screens_key_key UNIQUE (screen_key)
);
CREATE INDEX IF NOT EXISTS gathering_screens_gathering_id_idx ON public.gathering_screens (gathering_id);
CREATE UNIQUE INDEX IF NOT EXISTS gathering_screens_one_adoption
  ON public.gathering_screens (adopted_tournament_id, adopted_monitor_id) WHERE adopted_tournament_id IS NOT NULL;
COMMENT ON TABLE public.gathering_screens IS
  '20261122_001 (A1b): Bildschirme der Veranstaltung (Hallen-Link /halle/<screen_key>). Keine Tabellenrechte fuer Clients; Schreiben nur ueber die Funktionen, Lesen nur gathering_screens_overview (Eigentuemer) bzw. gathering_screen_display (per Schluessel, Positivliste).';

DROP TRIGGER IF EXISTS gathering_screens_updated_at ON public.gathering_screens;
CREATE TRIGGER gathering_screens_updated_at BEFORE UPDATE ON public.gathering_screens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Zulaessigkeit (eine Regel, ein Ort)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gathering_location_key(p_location text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT nullif(lower(regexp_replace(btrim(coalesce(p_location, '')), '[[:space:]]+', ' ', 'g')), '');
$$;
REVOKE ALL ON FUNCTION public.gathering_location_key(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gathering_screen_reason(p_gathering_id uuid, p_tournament_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN t.id IS NULL THEN 'not_found'
           WHEN g.id IS NULL OR t.gathering_id IS DISTINCT FROM g.id THEN 'not_in_gathering'
           WHEN t.deleted_at IS NOT NULL THEN 'trashed'
           WHEN t.lifecycle_status = 'cancelled' THEN 'cancelled'
           WHEN t.lifecycle_status IS DISTINCT FROM 'fixed' AND t.lifecycle_status IS DISTINCT FROM 'finished' THEN 'draft'
           WHEN NOT EXISTS (SELECT 1 FROM public.gathering_screens s WHERE s.gathering_id = g.id) THEN 'no_screens'
           WHEN public.gathering_location_key(g.screen_location_name) IS NULL THEN 'no_location'
           WHEN public.gathering_location_key(t.location_name) IS DISTINCT FROM public.gathering_location_key(g.screen_location_name)
             THEN 'other_location'
         END
    FROM (SELECT 1) AS one
    LEFT JOIN public.tournaments t ON t.id = p_tournament_id
    LEFT JOIN public.gatherings g ON g.id = p_gathering_id;
$$;
COMMENT ON FUNCTION public.gathering_screen_reason(uuid, uuid) IS
  '20261122_001 (A1b, @VA-036, @VA-041): NULL = Turnier darf auf die Bildschirme der Veranstaltung, sonst der Grund (not_found, not_in_gathering, trashed, cancelled, draft, no_screens, no_location, other_location).';
REVOKE ALL ON FUNCTION public.gathering_screen_reason(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Turniere einer Veranstaltung mit Zustand (Lesart wie public_gathering, Fassung 20261119_001), auch nicht geteilte.
CREATE OR REPLACE FUNCTION public.gathering_tournament_list(p_gathering_id uuid)
RETURNS TABLE (id uuid, title text, date date, begin_time time without time zone, location_name text, is_public boolean,
               share_code text, state text, last_match_started boolean, reason text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.title, t.date, coalesce(ms.first_start, t.start_time), t.location_name, coalesce(t.is_public, false),
         t.share_code,
         CASE WHEN t.lifecycle_status = 'cancelled' THEN 'cancelled'
              WHEN t.lifecycle_status = 'finished' THEN 'finished'
              WHEN ms.started AND (now() AT TIME ZONE 'Europe/Berlin')::date >= t.date + 2 THEN 'finished'   -- gekappt (wie @HE-111)
              WHEN ms.started THEN 'live'
              ELSE 'planned' END,
         coalesce((SELECT bool_and(m.match_status IN ('running', 'paused', 'finished') OR m.skipped_at IS NOT NULL)
                     FROM public.matches m
                    WHERE m.tournament_id = t.id
                      AND m.scheduled_start = (SELECT max(m2.scheduled_start) FROM public.matches m2
                                                WHERE m2.tournament_id = t.id)), false),
         public.gathering_screen_reason(p_gathering_id, t.id)
    FROM public.tournaments t
    LEFT JOIN LATERAL (
      SELECT coalesce(bool_or(m.match_status IN ('running', 'paused', 'finished')), false) AS started,
             min(m.scheduled_start) AS first_start
        FROM public.matches m WHERE m.tournament_id = t.id) AS ms ON true
   WHERE t.gathering_id = p_gathering_id AND t.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.gathering_tournament_list(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Folien-Konfiguration und Sponsoren pruefen (HF014).
CREATE OR REPLACE FUNCTION public.gathering_screen_config_check(p_config jsonb, p_sponsors jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_bytes constant integer := 1048576;
BEGIN
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object'
     OR (p_config ? 'slides' AND jsonb_typeof(p_config -> 'slides') <> 'array')
     OR p_sponsors IS NULL OR jsonb_typeof(p_sponsors) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_sponsors) AS x(sp) WHERE jsonb_typeof(sp) <> 'object')
     OR octet_length(p_config::text) + octet_length(p_sponsors::text) > c_max_bytes THEN
    RAISE EXCEPTION 'GATHERING_SCREEN_CONFIG_INVALID: config muss ein Objekt (slides ein Array), sponsors ein Array von Objekten sein, zusammen hoechstens 1 MiB.'
      USING ERRCODE = 'HF014';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.gathering_screen_config_check(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Das Turnier in der Halle kommt nie still zurueck
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournaments_clear_on_screen() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  -- Nach dem endgueltigen Loeschen ist der Grund 'not_found', also ebenfalls abgeraeumt.
  UPDATE public.gatherings g SET on_screen_tournament_id = NULL, on_screen_since = now()
   WHERE g.on_screen_tournament_id = v_id
     AND public.gathering_screen_reason(g.id, v_id) IS NOT NULL;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_clear_on_screen() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS tournaments_clear_on_screen ON public.tournaments;
CREATE TRIGGER tournaments_clear_on_screen
  AFTER UPDATE ON public.tournaments
  FOR EACH ROW WHEN (OLD.gathering_id IS NOT NULL
                     AND (OLD.gathering_id, OLD.deleted_at, OLD.lifecycle_status, OLD.location_name)
                         IS DISTINCT FROM (NEW.gathering_id, NEW.deleted_at, NEW.lifecycle_status, NEW.location_name))
  EXECUTE FUNCTION public.tournaments_clear_on_screen();
DROP TRIGGER IF EXISTS tournaments_clear_on_screen_delete ON public.tournaments;
CREATE TRIGGER tournaments_clear_on_screen_delete
  AFTER DELETE ON public.tournaments
  FOR EACH ROW WHEN (OLD.gathering_id IS NOT NULL)
  EXECUTE FUNCTION public.tournaments_clear_on_screen();

-- Unzulaessiges Turnier in der Halle einer Veranstaltung abraeumen (Ort geaendert, letzter Bildschirm geloescht).
CREATE OR REPLACE FUNCTION public.gathering_clear_ineligible_on_screen(p_gathering_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.gatherings g SET on_screen_tournament_id = NULL, on_screen_since = now()
   WHERE g.id = p_gathering_id AND g.on_screen_tournament_id IS NOT NULL
     AND public.gathering_screen_reason(g.id, g.on_screen_tournament_id) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.gathering_clear_ineligible_on_screen(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5a. Bildschirme einrichten (@VA-034, @VA-036 Z. 6, @VA-041, @VA-042 Herkunft) -- editGathering (im MVP der Eigentuemer)
-- ---------------------------------------------------------------------------------------------------------------
-- Veranstaltung sperren und Recht pruefen (HF008 vor HF006, wie A1).
CREATE OR REPLACE FUNCTION public.gathering_lock_for_screens(p_gathering_id uuid) RETURNS public.gatherings
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_g public.gatherings;
BEGIN
  SELECT * INTO v_g FROM public.gatherings g WHERE g.id = p_gathering_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF008';
  END IF;
  IF NOT public.has_gathering_permission(p_gathering_id, 'editGathering') THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF006';
  END IF;
  RETURN v_g;
END;
$$;
REVOKE ALL ON FUNCTION public.gathering_lock_for_screens(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gathering_screen_new_key() RETURNS text
LANGUAGE sql VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT encode(extensions.gen_random_bytes(16), 'hex');
$$;
REVOKE ALL ON FUNCTION public.gathering_screen_new_key() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_gathering_screen(p_gathering_id uuid, p_name text, p_config jsonb,
                                                         p_sponsors jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_per_gathering constant integer := 10;
  v_name text;
  v_key text;
  v_id uuid;
BEGIN
  PERFORM public.gathering_lock_for_screens(p_gathering_id);
  v_name := public.gathering_name_or_fail(p_name);
  PERFORM public.gathering_screen_config_check(p_config, p_sponsors);
  IF (SELECT count(*) FROM public.gathering_screens s WHERE s.gathering_id = p_gathering_id) >= c_max_per_gathering THEN
    RAISE EXCEPTION 'GATHERING_SCREEN_LIMIT: hoechstens % Bildschirme je Veranstaltung.', c_max_per_gathering USING ERRCODE = 'HF013';
  END IF;
  v_key := public.gathering_screen_new_key();
  INSERT INTO public.gathering_screens (gathering_id, name, screen_key, config, sponsors)
  VALUES (p_gathering_id, v_name, v_key, p_config, p_sponsors)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'key', v_key);
END;
$$;
COMMENT ON FUNCTION public.create_gathering_screen(uuid, text, jsonb, jsonb) IS
  '20261122_001 (@VA-034): legt einen Bildschirm der Veranstaltung an (Folien, Sponsoren) und erzeugt seinen Schluessel; Antwort {id, key}. Recht editGathering. Fehler HF006, HF008, HF010, HF013, HF014.';

CREATE OR REPLACE FUNCTION public.update_gathering_screen(p_screen_id uuid, p_name text, p_config jsonb, p_sponsors jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gid uuid;
  v_name text;
BEGIN
  SELECT s.gathering_id INTO v_gid FROM public.gathering_screens s WHERE s.id = p_screen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Bildschirm %.', p_screen_id USING ERRCODE = 'HF008';
  END IF;
  PERFORM public.gathering_lock_for_screens(v_gid);
  v_name := public.gathering_name_or_fail(p_name);
  PERFORM public.gathering_screen_config_check(p_config, p_sponsors);
  UPDATE public.gathering_screens SET name = v_name, config = p_config, sponsors = p_sponsors WHERE id = p_screen_id;
END;
$$;
COMMENT ON FUNCTION public.update_gathering_screen(uuid, text, jsonb, jsonb) IS
  '20261122_001 (@VA-034): Name, Folien und Sponsoren eines Bildschirms; der Bildschirm bekommt danach eine volle Antwort. Recht editGathering. Fehler HF006, HF008, HF010, HF014.';

CREATE OR REPLACE FUNCTION public.rotate_gathering_screen_key(p_screen_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gid uuid;
  v_key text;
BEGIN
  SELECT s.gathering_id INTO v_gid FROM public.gathering_screens s WHERE s.id = p_screen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Bildschirm %.', p_screen_id USING ERRCODE = 'HF008';
  END IF;
  PERFORM public.gathering_lock_for_screens(v_gid);
  v_key := public.gathering_screen_new_key();
  UPDATE public.gathering_screens SET screen_key = v_key, key_created_at = now() WHERE id = p_screen_id;
  RETURN jsonb_build_object('key', v_key);
END;
$$;
COMMENT ON FUNCTION public.rotate_gathering_screen_key(uuid) IS
  '20261122_001 (@VA-036 Z. 6): neuer Schluessel, der alte ist sofort ungueltig (Bildschirm-Abfrage {state:invalid}). Recht editGathering. Fehler HF006, HF008.';

CREATE OR REPLACE FUNCTION public.delete_gathering_screen(p_screen_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gid uuid;
BEGIN
  SELECT s.gathering_id INTO v_gid FROM public.gathering_screens s WHERE s.id = p_screen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Bildschirm %.', p_screen_id USING ERRCODE = 'HF008';
  END IF;
  PERFORM public.gathering_lock_for_screens(v_gid);
  -- Eine Uebernahme endet damit; der Turnier-Monitor gilt wieder (Entscheidung 06.11., Frage 5).
  DELETE FROM public.gathering_screens WHERE id = p_screen_id;
  -- Ohne Bildschirme steht nichts mehr in der Halle (no_screens).
  PERFORM public.gathering_clear_ineligible_on_screen(v_gid);
END;
$$;
COMMENT ON FUNCTION public.delete_gathering_screen(uuid) IS
  '20261122_001 (@VA-034, @VA-042): loescht einen Bildschirm; ohne Bildschirme steht kein Turnier mehr in der Halle. Recht editGathering. Fehler HF006, HF008.';

CREATE OR REPLACE FUNCTION public.adopt_tournament_monitor(p_gathering_id uuid, p_tournament_id uuid, p_monitor_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_per_gathering constant integer := 10;
  v_g public.gatherings;
  v_t public.tournaments;
  v_monitor jsonb;
  v_config jsonb;
  v_sponsors jsonb;
  v_name text;
  v_key text;
  v_id uuid;
BEGIN
  v_g := public.gathering_lock_for_screens(p_gathering_id);
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Turnier % fehlt oder liegt im Papierkorb.', p_tournament_id USING ERRCODE = 'HF008';
  END IF;
  IF v_t.owner_id IS DISTINCT FROM v_g.owner_id THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Turnier % gehoert einem anderen Konto.', p_tournament_id USING ERRCODE = 'HF006';
  END IF;
  SELECT m INTO v_monitor
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_t.config -> 'monitors') = 'array'
                                   THEN v_t.config -> 'monitors' ELSE '[]'::jsonb END) AS x(m)
   WHERE jsonb_typeof(m) = 'object' AND m ->> 'id' = p_monitor_id
   LIMIT 1;
  IF v_monitor IS NULL OR p_monitor_id IS NULL OR char_length(p_monitor_id) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Monitor % im Turnier %.', p_monitor_id, p_tournament_id USING ERRCODE = 'HF008';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gathering_screens s
              WHERE s.adopted_tournament_id = p_tournament_id AND s.adopted_monitor_id = p_monitor_id) THEN
    RAISE EXCEPTION 'GATHERING_SCREEN_TAKEN: Monitor % ist schon uebernommen.', p_monitor_id USING ERRCODE = 'HF015';
  END IF;
  IF (SELECT count(*) FROM public.gathering_screens s WHERE s.gathering_id = p_gathering_id) >= c_max_per_gathering THEN
    RAISE EXCEPTION 'GATHERING_SCREEN_LIMIT: hoechstens % Bildschirme je Veranstaltung.', c_max_per_gathering USING ERRCODE = 'HF013';
  END IF;
  v_name := public.gathering_name_or_fail(coalesce(v_monitor ->> 'name', ''));
  v_config := v_monitor - 'id' - 'name' - 'createdAt' - 'updatedAt';
  -- Nur die Sponsoren, die seine Folien nennen (wie config_for fuer den Bildschirm).
  SELECT coalesce(jsonb_agg(sp ORDER BY ord), '[]'::jsonb) INTO v_sponsors
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_t.config -> 'sponsors') = 'array'
                                   THEN v_t.config -> 'sponsors' ELSE '[]'::jsonb END) WITH ORDINALITY AS z(sp, ord)
   WHERE jsonb_typeof(sp) = 'object'
     AND sp ->> 'id' IN (SELECT s -> 'config' ->> 'sponsorId'
                           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_config -> 'slides') = 'array'
                                                          THEN v_config -> 'slides' ELSE '[]'::jsonb END) AS y(s)
                          WHERE jsonb_typeof(s) = 'object');
  PERFORM public.gathering_screen_config_check(v_config, v_sponsors);
  v_key := public.gathering_screen_new_key();
  BEGIN
    INSERT INTO public.gathering_screens (gathering_id, name, screen_key, config, sponsors, adopted_tournament_id,
                                          adopted_monitor_id)
    VALUES (p_gathering_id, v_name, v_key, v_config, v_sponsors, p_tournament_id, p_monitor_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'GATHERING_SCREEN_TAKEN: Monitor % ist schon uebernommen.', p_monitor_id USING ERRCODE = 'HF015';
  END;
  RETURN jsonb_build_object('id', v_id, 'key', v_key);
END;
$$;
COMMENT ON FUNCTION public.adopt_tournament_monitor(uuid, uuid, text) IS
  '20261122_001 (@VA-042, Herkunft): legt einen Bildschirm mit Name, Einstellungen und den Sponsoren seiner Folien aus einem Monitor eines eigenen Turniers an (auch abgeschlossen) und merkt sich die Herkunft. Der Turnier-Link bleibt technisch unveraendert (Exklusivitaet in der App, A7). Antwort {id, key}. Recht editGathering. Fehler HF006, HF008, HF010, HF013, HF014, HF015.';

CREATE OR REPLACE FUNCTION public.set_gathering_screen_location(p_gathering_id uuid, p_location text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_location text;
BEGIN
  PERFORM public.gathering_lock_for_screens(p_gathering_id);
  v_location := CASE WHEN p_location IS NULL THEN NULL ELSE public.gathering_name_or_fail(p_location) END;
  UPDATE public.gatherings SET screen_location_name = v_location WHERE id = p_gathering_id;
  PERFORM public.gathering_clear_ineligible_on_screen(p_gathering_id);
END;
$$;
COMMENT ON FUNCTION public.set_gathering_screen_location(uuid, text) IS
  '20261122_001 (@VA-041): Ort der Bildschirme (NULL = keiner); ein Turnier in der Halle an einem anderen Ort steht danach nicht mehr dort. Recht editGathering. Fehler HF006, HF008, HF010.';

-- ---------------------------------------------------------------------------------------------------------------
-- 5b. Umschalten und Status (@VA-035 bis @VA-041) -- manageScreens am Turnier
-- ---------------------------------------------------------------------------------------------------------------
-- Turnier in der Halle aus Sicht des Aufrufers: Titel nur mit manageScreens dort, sonst {other: true}.
CREATE OR REPLACE FUNCTION public.gathering_on_screen_for_caller(p_gathering_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN g.on_screen_tournament_id IS NULL
                OR public.gathering_screen_reason(g.id, g.on_screen_tournament_id) IS NOT NULL THEN NULL
           WHEN public.is_real_account() AND public.has_tournament_permission(g.on_screen_tournament_id, 'manageScreens')
             THEN jsonb_build_object('tournament_id', t.id, 'title', t.title, 'since', g.on_screen_since)
           ELSE jsonb_build_object('other', true, 'since', g.on_screen_since)
         END
    FROM public.gatherings g
    LEFT JOIN public.tournaments t ON t.id = g.on_screen_tournament_id
   WHERE g.id = p_gathering_id;
$$;
REVOKE ALL ON FUNCTION public.gathering_on_screen_for_caller(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Turnier pruefen (HF008 vor HF006): nicht im Papierkorb, Aufrufer mit echtem Konto und manageScreens.
CREATE OR REPLACE FUNCTION public.gathering_screen_tournament_or_fail(p_tournament_id uuid) RETURNS public.tournaments
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
BEGIN
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Turnier % fehlt oder liegt im Papierkorb.', p_tournament_id USING ERRCODE = 'HF008';
  END IF;
  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageScreens')) THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Turnier %.', p_tournament_id USING ERRCODE = 'HF006';
  END IF;
  RETURN v_t;
END;
$$;
REVOKE ALL ON FUNCTION public.gathering_screen_tournament_or_fail(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_gathering_on_screen(p_tournament_id uuid, p_on boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
  v_g public.gatherings;
  v_reason text;
BEGIN
  IF p_on IS NULL THEN
    RAISE EXCEPTION 'GATHERING_INVALID_INPUT: p_on fehlt.' USING ERRCODE = '22023';
  END IF;
  v_t := public.gathering_screen_tournament_or_fail(p_tournament_id);
  IF v_t.gathering_id IS NULL THEN
    RAISE EXCEPTION 'GATHERING_SCREEN_NOT_ELIGIBLE: not_in_gathering (Turnier %).', p_tournament_id USING ERRCODE = 'HF012';
  END IF;
  -- Letzter Tipp gilt (@VA-038): gleichzeitige Aufrufe warten aufeinander und lesen danach den neuen Stand.
  SELECT * INTO v_g FROM public.gatherings g WHERE g.id = v_t.gathering_id FOR UPDATE;
  IF p_on THEN
    v_reason := public.gathering_screen_reason(v_g.id, p_tournament_id);
    IF v_reason IS NOT NULL THEN
      RAISE EXCEPTION 'GATHERING_SCREEN_NOT_ELIGIBLE: % (Turnier %).', v_reason, p_tournament_id USING ERRCODE = 'HF012';
    END IF;
    IF v_g.on_screen_tournament_id IS DISTINCT FROM p_tournament_id THEN
      UPDATE public.gatherings SET on_screen_tournament_id = p_tournament_id, on_screen_since = now() WHERE id = v_g.id;
    END IF;
  ELSIF v_g.on_screen_tournament_id = p_tournament_id THEN
    -- "Von den Bildschirmen nehmen" nimmt nur genau dieses Turnier herunter.
    UPDATE public.gatherings SET on_screen_tournament_id = NULL, on_screen_since = now() WHERE id = v_g.id;
  END IF;
  RETURN jsonb_build_object('on_screen', public.gathering_on_screen_for_caller(v_g.id));
END;
$$;
COMMENT ON FUNCTION public.set_gathering_on_screen(uuid, boolean) IS
  '20261122_001 (@VA-035 bis @VA-038, @VA-041): "Auf die Bildschirme" (p_on true) bzw. "Von den Bildschirmen nehmen" (false, nur fuer genau dieses Turnier). Letzter Tipp gilt. Recht manageScreens am Turnier (Eigentuemer mit Konto, Co-Admin). Antwort {on_screen}. Fehler HF006, HF008, HF012, 22023.';

CREATE OR REPLACE FUNCTION public.gathering_screen_status(p_tournament_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
  v_reason text;
  v_on jsonb;
BEGIN
  v_t := public.gathering_screen_tournament_or_fail(p_tournament_id);
  v_reason := public.gathering_screen_reason(v_t.gathering_id, p_tournament_id);
  v_on := CASE WHEN v_t.gathering_id IS NOT NULL THEN public.gathering_on_screen_for_caller(v_t.gathering_id) END;
  RETURN jsonb_build_object(
    'in_gathering', v_t.gathering_id IS NOT NULL,
    'has_screens', v_t.gathering_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM public.gathering_screens s WHERE s.gathering_id = v_t.gathering_id),
    'eligible', v_reason IS NULL,
    'reason', v_reason,
    'on_screen_self', coalesce(v_on ->> 'tournament_id' = p_tournament_id::text, false),
    'on_screen', v_on,
    'handed_over_monitor_ids', (SELECT coalesce(jsonb_agg(s.adopted_monitor_id ORDER BY s.adopted_monitor_id), '[]'::jsonb)
                                  FROM public.gathering_screens s WHERE s.adopted_tournament_id = p_tournament_id));
END;
$$;
COMMENT ON FUNCTION public.gathering_screen_status(uuid) IS
  '20261122_001 (@VA-037, @VA-039, @VA-041, @VA-042): fuer Cockpit und Turnierverwaltung -- {in_gathering, has_screens, eligible, reason, on_screen_self, on_screen, handed_over_monitor_ids}. Recht manageScreens am Turnier. Fehler HF006, HF008.';

CREATE OR REPLACE FUNCTION public.gathering_screens_overview(p_gathering_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_g public.gatherings;
BEGIN
  SELECT * INTO v_g FROM public.gatherings g WHERE g.id = p_gathering_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATHERING_NOT_FOUND: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF008';
  END IF;
  IF NOT public.has_gathering_permission(p_gathering_id, 'readGathering') THEN
    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Veranstaltung %.', p_gathering_id USING ERRCODE = 'HF006';
  END IF;
  RETURN jsonb_build_object(
    'screen_location_name', v_g.screen_location_name,
    'on_screen', public.gathering_on_screen_for_caller(p_gathering_id),
    'screens', (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                         'id', s.id, 'name', s.name, 'key', s.screen_key, 'key_created_at', s.key_created_at,
                         'updated_at', s.updated_at,
                         'adopted_from', CASE WHEN s.adopted_tournament_id IS NOT NULL THEN jsonb_build_object(
                                           'tournament_id', s.adopted_tournament_id, 'monitor_id', s.adopted_monitor_id) END))
                       || jsonb_build_object('config', s.config, 'sponsors', s.sponsors)
                       ORDER BY s.created_at, s.name, s.id), '[]'::jsonb)
                  FROM public.gathering_screens s WHERE s.gathering_id = p_gathering_id),
    'tournaments', (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                             'id', l.id, 'title', l.title, 'date', l.date, 'begin', l.begin_time, 'state', l.state,
                             'eligible', l.reason IS NULL, 'reason', l.reason))
                           ORDER BY l.date, l.begin_time NULLS LAST, l.title, l.id), '[]'::jsonb)
                      FROM public.gathering_tournament_list(p_gathering_id) AS l));
END;
$$;
COMMENT ON FUNCTION public.gathering_screens_overview(uuid) IS
  '20261122_001 (@VA-034, @VA-040): Bildschirme mit Schluessel, Ort, Turnier in der Halle und alle Turniere mit Zustand und Zulaessigkeit -- nur fuer den Eigentuemer (readGathering). Fehler HF006, HF008.';

-- ---------------------------------------------------------------------------------------------------------------
-- 5c. Bildschirm-Abfrage per Schluessel (@VA-034 bis @VA-036, @VA-043, @VA-044, @ZM-180)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gathering_screen_display(p_key text, p_since_version bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_lag_us constant bigint := 5000000;
  v_now_us bigint := public_view.epoch_us(now());
  v_server_now bigint := floor(extract(epoch FROM now()) * 1000)::bigint;
  v_s public.gathering_screens;
  v_g public.gatherings;
  v_t uuid;
  v_base_us bigint;
  v_all_us bigint;
  v_inner_us bigint;
  v_version bigint;
  v_since_ok boolean;
  v_slides jsonb;
  v_screen jsonb;
  v_sponsors jsonb;
  v_head jsonb;
  v_payload jsonb;
BEGIN
  -- @VA-043: nur genau das Schluessel-Format; ein oeffentlicher Code (6 Zeichen) oeffnet nie einen Bildschirm.
  IF p_key IS NULL OR p_key !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('state', 'invalid');
  END IF;
  SELECT * INTO v_s FROM public.gathering_screens s WHERE s.screen_key = p_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'invalid');
  END IF;
  SELECT * INTO v_g FROM public.gatherings g WHERE g.id = v_s.gathering_id;
  v_t := CASE WHEN v_g.on_screen_tournament_id IS NOT NULL
                   AND public.gathering_screen_reason(v_g.id, v_g.on_screen_tournament_id) IS NULL
              THEN v_g.on_screen_tournament_id END;

  -- Version (@ZM-180): Veranstaltung, Bildschirm und alle zugeordneten Turniere (Bestandteile wie public_payload).
  v_base_us := greatest(public_view.epoch_us(v_g.updated_at), public_view.epoch_us(v_s.updated_at));
  SELECT coalesce(max(p.us), 0), coalesce(max(p.us) FILTER (WHERE p.id = v_t), 0) INTO v_all_us, v_inner_us
    FROM (SELECT t.id,
                 greatest(coalesce(public_view.epoch_us(coalesce(t.updated_at, t.created_at, '-infinity'::timestamptz)), 0),
                          coalesce((SELECT public_view.epoch_us(max(tm.updated_at)) FROM public.teams tm WHERE tm.tournament_id = t.id), 0),
                          coalesce((SELECT public_view.epoch_us(max(m.updated_at)) FROM public.matches m WHERE m.tournament_id = t.id), 0),
                          coalesce((SELECT public_view.epoch_us(sc.changed_at) FROM public_view.structure_changes sc
                                     WHERE sc.tournament_id = t.id), 0), 0) AS us
            FROM public.tournaments t
           WHERE t.gathering_id = v_g.id AND t.deleted_at IS NULL) AS p;
  v_version := greatest(least(greatest(v_base_us, v_all_us), v_now_us - c_lag_us), 0);
  v_since_ok := p_since_version IS NOT NULL AND p_since_version >= 0 AND p_since_version <= v_version;

  IF v_since_ok AND greatest(v_base_us, CASE WHEN v_t IS NULL THEN v_all_us ELSE v_inner_us END) <= p_since_version THEN
    RETURN jsonb_build_object('state', 'unchanged', 'version', v_version, 'server_now', v_server_now);
  END IF;

  v_head := jsonb_build_object('version', v_version, 'server_now', v_server_now);
  IF v_t IS NOT NULL AND v_since_ok AND v_base_us <= p_since_version THEN
    -- Delta des Turniers in der Halle (since liegt hier unter dessen eigener Version).
    v_payload := public_view.public_payload(v_t, p_since_version, 'screen', NULL);
    RETURN v_head || jsonb_build_object('state', 'tournament',
                                        'on_screen', jsonb_build_object('tournament_id', v_t, 'since', v_g.on_screen_since),
                                        'payload', v_payload - 'version' - 'server_now');
  END IF;

  -- Volle Antwort: Folien des Bildschirms (Positivliste) und nur die Sponsoren seiner Folien.
  v_slides := CASE WHEN jsonb_typeof(v_s.config -> 'slides') = 'array' THEN v_s.config -> 'slides' ELSE '[]'::jsonb END;
  v_screen := public_view.without_nulls(jsonb_build_object(
      'id', v_s.id, 'name', v_s.name,
      'defaultSlideDuration', v_s.config -> 'defaultSlideDuration', 'transition', v_s.config -> 'transition',
      'transitionDuration', v_s.config -> 'transitionDuration', 'theme', v_s.config -> 'theme',
      'performanceMode', v_s.config -> 'performanceMode', 'overscanPercent', v_s.config -> 'overscanPercent'))
    || jsonb_build_object('slides', v_slides);
  SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
           'id', sp -> 'id', 'name', sp -> 'name', 'logoUrl', sp -> 'logoUrl', 'logoBase64', sp -> 'logoBase64',
           'websiteUrl', sp -> 'websiteUrl', 'tier', sp -> 'tier')) ORDER BY ord), '[]'::jsonb) INTO v_sponsors
    FROM jsonb_array_elements(v_s.sponsors) WITH ORDINALITY AS z(sp, ord)
   WHERE jsonb_typeof(sp) = 'object'
     AND sp ->> 'id' IN (SELECT y.s -> 'config' ->> 'sponsorId' FROM jsonb_array_elements(v_slides) AS y(s)
                          WHERE jsonb_typeof(y.s) = 'object');
  v_head := v_head || jsonb_build_object('gathering', jsonb_build_object('name', v_g.name, 'share_code', v_g.share_code),
                                         'screen', v_screen, 'sponsors', v_sponsors);

  IF v_t IS NULL THEN
    -- Folie der Veranstaltung (@VA-036 Z. 2): alle zulaessigen Turniere, auch nicht geteilte (Halle, nicht Internet).
    RETURN v_head || jsonb_build_object('state', 'gathering', 'tournaments', (
      SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'title', l.title, 'date', l.date, 'begin', l.begin_time, 'state', l.state,
               'last_match_started', l.last_match_started))
             ORDER BY l.date, l.begin_time NULLS LAST, l.title, l.id), '[]'::jsonb)
        FROM public.gathering_tournament_list(v_g.id) AS l
       WHERE l.reason IS NULL));
  END IF;

  v_payload := public_view.public_payload(v_t, NULL, 'screen', NULL);
  RETURN v_head || jsonb_build_object('state', 'tournament',
                                      'on_screen', jsonb_build_object('tournament_id', v_t, 'since', v_g.on_screen_since),
                                      'payload', v_payload - 'version' - 'server_now');
END;
$$;
COMMENT ON FUNCTION public.gathering_screen_display(text, bigint) IS
  '20261122_001 (A1b): Abfrage des Bildschirms der Veranstaltung per Schluessel. {state:invalid} | {state:unchanged} | {state:gathering, screen, sponsors, gathering, tournaments} | {state:tournament, on_screen, [gathering, screen, sponsors,] payload (Monitor-Fassung des Turniers in der Halle)}; version monoton ueber Wechsel (@ZM-180). Nie: Schluessel, andere Bildschirme, Herkunft, Ort.';

CREATE OR REPLACE FUNCTION public.gathering_screen_final_standings(p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gid uuid;
  v_tid uuid;
  v_t public.tournaments;
  v_finished_at timestamptz;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT g.id, g.on_screen_tournament_id INTO v_gid, v_tid
    FROM public.gathering_screens s JOIN public.gatherings g ON g.id = s.gathering_id
   WHERE s.screen_key = p_key;
  IF v_tid IS NULL OR public.gathering_screen_reason(v_gid, v_tid) IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = v_tid;
  -- Wieder geoeffnet (@LZ-091): der gespeicherte Endstand unveraendert, wie display_final_standings (20261118_008 (B)).
  IF v_t.lifecycle_status = 'fixed' THEN
    SELECT fs.finished_at INTO v_finished_at
      FROM public.tournament_final_standings fs WHERE fs.tournament_id = v_t.id;
    IF v_finished_at IS NOT NULL THEN
      v_t.lifecycle_status := 'finished';
      v_t.finished_at := v_finished_at;
    END IF;
  END IF;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;
COMMENT ON FUNCTION public.gathering_screen_final_standings(text) IS
  '20261122_001 (@VA-036 Z. 4): Endstand des Turniers in der Halle fuer den Bildschirm der Veranstaltung (Zweige wie display_final_standings, Kindermodus/Torschuetzen wie final_standings_payload); sonst {status:none}.';

-- ---------------------------------------------------------------------------------------------------------------
-- 5d. Zuschauer: "Jetzt in der Halle" (@VA-045 bis @VA-047)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gathering_public_on_screen(p_gathering_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'share_code', t.share_code, 'title', t.title,
           'live_matches', (
             SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
                      'match_number', m.match_number, 'field', m.field, 'status', m.match_status,
                      'score_a', CASE WHEN sc.visible THEN m.score_a END,
                      'score_b', CASE WHEN sc.visible THEN m.score_b END))
                    ORDER BY m.field, m.match_number, m.id), '[]'::jsonb)
               FROM public.matches m
              WHERE m.tournament_id = t.id AND m.match_status IN ('running', 'paused')))
    FROM public.gatherings g
    JOIN public.tournaments t ON t.id = g.on_screen_tournament_id
    CROSS JOIN LATERAL (
      SELECT NOT (public_view.switches(t.config) ->> 'kidsMode')::boolean
             AND (public_view.switches(t.config) ->> 'liveScore')::boolean AS visible) AS sc
   WHERE g.id = p_gathering_id
     AND coalesce(t.is_public, false) AND t.share_code IS NOT NULL
     AND public.gathering_screen_reason(g.id, t.id) IS NULL;
$$;
COMMENT ON FUNCTION public.gathering_public_on_screen(uuid) IS
  '20261122_001 (@VA-045 bis @VA-047): Turnier in der Halle fuer Zuschauer -- nur mit Bildschirmen, zulaessig und oeffentlich; laufende Spiele, Stand nur ohne Kindermodus und mit Live-Stand. Sonst NULL.';
REVOKE ALL ON FUNCTION public.gathering_public_on_screen(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- public_gathering: Fassung 20261119_001 woertlich, nur on_screen in der vollen Antwort ergaenzt.
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
                              'tournaments', v_list)
      -- 20261120_002 (@VA-045 bis @VA-047): Turnier in der Halle, nur mit Bildschirmen, zulaessig und oeffentlich.
      || coalesce((SELECT jsonb_build_object('on_screen', o) FROM public.gathering_public_on_screen(v_g.id) AS o WHERE o IS NOT NULL), '{}'::jsonb);
  END IF;
  IF v_assigned = 0 OR v_upcoming THEN
    RETURN jsonb_build_object('state', 'pending', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name);
  END IF;
  RETURN jsonb_build_object('state', 'not_found');
END;
$$;
COMMENT ON FUNCTION public.public_gathering(text) IS
  '20261119_001 (A1), 20261122_001 (A1b): oeffentliche Seite der Veranstaltung. {state:not_found} | {state:pending, version, server_now, name} | {state:full, version, server_now, name, tournaments:[title, date, begin, location_name, state, last_match_started, share_code][, on_screen:{share_code, title, live_matches}]}; nur oeffentliche, nicht geloeschte Turniere, keine Teams, Kontakte oder Anzahlen; on_screen nur fuer ein oeffentliches, zulaessiges Turnier in der Halle, Stand nur ohne Kindermodus und mit Live-Stand. Immer Voll-Antwort; version monoton.';

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Rechte
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.gathering_screens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gathering_screens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gathering_screens TO ci_schema_reader;   -- nur pg_dump; RLS ohne Policy: 0 Zeilen

REVOKE ALL ON FUNCTION public.create_gathering_screen(uuid, text, jsonb, jsonb),
                       public.update_gathering_screen(uuid, text, jsonb, jsonb),
                       public.rotate_gathering_screen_key(uuid), public.delete_gathering_screen(uuid),
                       public.adopt_tournament_monitor(uuid, uuid, text), public.set_gathering_screen_location(uuid, text),
                       public.set_gathering_on_screen(uuid, boolean), public.gathering_screen_status(uuid),
                       public.gathering_screens_overview(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_gathering_screen(uuid, text, jsonb, jsonb),
                          public.update_gathering_screen(uuid, text, jsonb, jsonb),
                          public.rotate_gathering_screen_key(uuid), public.delete_gathering_screen(uuid),
                          public.adopt_tournament_monitor(uuid, uuid, text), public.set_gathering_screen_location(uuid, text),
                          public.set_gathering_on_screen(uuid, boolean), public.gathering_screen_status(uuid),
                          public.gathering_screens_overview(uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.gathering_screen_display(text, bigint), public.gathering_screen_final_standings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gathering_screen_display(text, bigint), public.gathering_screen_final_standings(text)
  TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.public_gathering(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_gathering(text) TO anon, authenticated, service_role;

COMMIT;
