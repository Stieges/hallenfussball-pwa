-- supabase/migrations/20261110_008_helper_join.sql
-- A-16 (Plan GA5 v2.1 § 3.1, Sicherheits-Review GA5 S-1..S-4, K-2..K-4): Helfer-Beitritt per QR ohne Konto
-- (@HE-004 @HE-006 @HE-007 @HE-008 @HE-009 @HE-010 (Teil) @HE-011 @HE-021 @HE-037 @HE-038 @HE-052 @HE-055 @HE-062 @HE-073
-- @HE-077 @HE-078 @HE-079 @HE-080 @HE-081 @HE-084 @HE-089 @HE-095 @HE-098 @HE-101 @HE-102 @HE-103 @HE-104 @HE-105 @HE-106
-- @LZ-044 @AN-007; Befund C-HELFER-OHNE-KONTO).
--
-- Inhalt (Entwurf A-16-entwurf-v21.sql, dazu):
--   S-1  decide_join_request(uuid, boolean, integer, smallint): Zulassen nur mit der Pruefzahl der Anfrage, sonst
--        {"result":"CHECK_MISMATCH"} ohne jede Aenderung (@HE-105). Ablehnen braucht keine Zahl.
--   S-2  list_helper_access: sameName zaehlt offene Anfragen, bestehende Zugaenge (label) und per Tipp abgelehnte
--        Anfragen gleichen Namens; dazu sameNamePending (@HE-021), sameNameMember {deviceLabel, acceptedAt} und
--        sameNameDeclinedAt (@HE-106).
--   S-3  request_helper_access: scheitern alle 5 Versuche an einer gleichzeitig vergebenen Pruefzahl -> BUSY statt
--        PENDING ohne Zeile.
--   S-4  display_name/device_label ohne Steuer- und Formatzeichen (CHECK; Name -> 22023 INVALID_NAME, Bezeichnung wird
--        bereinigt).
--   K-2  change_helper_access gibt die Feldsteuerung des Geraets frei (Halter NULL, Epoche +1).
--   K-3  Trigger protect_helper_access_row: die Rolle einer Zeile aus dem QR-Beitritt aendert nur eine Definer-Funktion.
--   K-4  request_helper_access liest den Code vor dem Anlegen FOR SHARE (Rotations-Restfenster -> ROTATED).
--
-- md5(prosrc) protect_collaborator_row: vorher (20260924_003, live) 4e0f2b4d408477ec8681090ad1e42342, danach (11a)
-- a5706467af5fab5cc92160fe68b3dfe1. Fail-fast bricht bei jeder anderen Fassung ohne Aenderung ab (M4b).
-- Idempotent: CREATE ... IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY/TRIGGER IF EXISTS vor CREATE, REVOKE/GRANT.
-- Typen-PR noetig (neue Funktionen/Tabellen); bis dahin ruft der Client ohne Typbindung (helperAccessRpc.ts).
--
-- RUECKWEG: eigene Datei (Anhang B von A-16-sql-freigabe.md, erzeugt mit
-- `bash scripts/helper-join-check.sh --print-rueckweg`), in EINEM Block. Vorher: App ohne GA5-Client, anonyme
-- Anmeldungen AUS. Geraete-Zugaenge werden gesperrt (declined_at), Zeilen bleiben (Verlauf); protect_collaborator_row
-- und collaborators_delete_v3 woertlich zurueck, neue Objekte weg. md5-Waechter: laeuft nur gegen die A-16-Fassung
-- (sonst gemeinsamer Rueckweg mit B-20, I-3). Belegt in scripts/helper-join-check.sh (Kategorie X).
--
-- Produktion: nur im DB-Fenster durch den Controller nach Daniels Freigabe (A-16-sql-freigabe.md), NACH 20261110_001
-- bis _004 (live). Unabhaengig von 20261110_005/_006/_007 und 20261113_101.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 0. Voraussetzungen (Fail-fast, ohne Aenderung) -- M1/F, M4(b)
DO $$
DECLARE v_pcr text;
BEGIN
  IF to_regprocedure('public.is_real_account()') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.protect_device_roles()') IS NULL
     OR to_regprocedure('public.protect_collaborator_row()') IS NULL
     OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL
     OR to_regclass('public.field_control') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'helper' AND permission = 'writeMatchData')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'co-admin' AND permission = 'manageHelpers') THEN
    RAISE EXCEPTION '20261110_008_helper_join: A-11/A-27/A-34 (20261110_001.._003), pgcrypto oder ci_schema_reader fehlen';
  END IF;
  -- M4(b): nie still eine spaetere Fassung des Triggers ueberschreiben (erlaubt: 20260924_003 oder diese Datei)
  SELECT md5(prosrc) INTO v_pcr FROM pg_proc WHERE oid = 'public.protect_collaborator_row()'::regprocedure;
  IF v_pcr NOT IN ('4e0f2b4d408477ec8681090ad1e42342', 'a5706467af5fab5cc92160fe68b3dfe1') THEN
    RAISE EXCEPTION '20261110_008_helper_join: protect_collaborator_row hat eine unbekannte Fassung (md5 %) -- erst klaeren', v_pcr;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tournament_collaborators'
                  AND policyname IN ('collaborators_delete_v3', 'collaborators_delete_v4')) THEN
    RAISE EXCEPTION '20261110_008_helper_join: Loesch-Policy collaborators_delete_v3/_v4 fehlt -- Drift, erst klaeren';
  END IF;
END $$;

-- 1. Tabellen (RLS an, keine Policy, keine Tabellenrechte fuer Clients; Schema-Dump fuer den Drift-Check)
--    S-4: Steuer- und Formatzeichen (C0/C1, weiches Trennzeichen, Breite-null, Richtungszeichen, Fueller, BOM, Tags).
CREATE TABLE IF NOT EXISTS public.tournament_join_codes (
  code          text PRIMARY KEY CHECK (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_join_codes_one_active
  ON public.tournament_join_codes (tournament_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.tournament_join_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  code           text NOT NULL REFERENCES public.tournament_join_codes(code) ON DELETE CASCADE,
  device_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 40
                   AND display_name !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]'),
  device_label   text CHECK (device_label IS NULL OR (char_length(device_label) BETWEEN 1 AND 40
                   AND device_label !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]')),
  check_number   smallint NOT NULL CHECK (check_number BETWEEN 10 AND 99),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  decline_reason text CHECK (decline_reason IS NULL OR decline_reason IN ('manual', 'rotated')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz,
  decided_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id      uuid REFERENCES public.tournament_collaborators(id) ON DELETE SET NULL,
  last_seen_at   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_join_requests_one_open
  ON public.tournament_join_requests (tournament_id, device_user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS tournament_join_requests_check_unique          -- M3/@HE-101: Pruefzahl je Turnier eindeutig
  ON public.tournament_join_requests (tournament_id, check_number) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS tournament_join_requests_by_tournament ON public.tournament_join_requests (tournament_id, status);
CREATE INDEX IF NOT EXISTS tournament_join_requests_by_member
  ON public.tournament_join_requests (member_id) WHERE member_id IS NOT NULL;

ALTER TABLE public.tournament_join_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_join_codes, public.tournament_join_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tournament_join_codes, public.tournament_join_requests TO ci_schema_reader;  -- nur pg_dump; RLS: 0 Zeilen

-- 2. Interne Hilfsfunktionen (kein EXECUTE fuer Clients)
CREATE OR REPLACE FUNCTION public.helper_code_cutoff(p_date date) RETURNS timestamptz
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT ((p_date + 1)::timestamp AT TIME ZONE 'Europe/Berlin') $$;            -- R-GA5-3, @HE-009/@HE-010

-- B1: jede Teilbedingung einzeln gegen NULL abgesichert; unbekanntes Turnier = geschlossen. Nur in Funktionsruempfen
-- verwenden (I-1, Rueckweg-DROP); A-21a ersetzt den Rumpf durch die eigene Regel.
CREATE OR REPLACE FUNCTION public.tournament_closed_for_helpers(p_tournament_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id)
      OR EXISTS (SELECT 1 FROM public.tournaments t
                  WHERE t.id = p_tournament_id
                    AND (    coalesce(t.deleted_at IS NOT NULL, false)
                          OR coalesce(t.status IN ('completed', 'cancelled', 'archived'), false)
                          OR coalesce((to_jsonb(t) ->> 'finished_at') IS NOT NULL, false)
                          OR coalesce((to_jsonb(t) ->> 'lifecycle_status') IN ('finished', 'cancelled'), false)))
$$;                                                                                    -- @HE-038, @LZ-044, @HE-070

CREATE OR REPLACE FUNCTION public.generate_helper_code() RETURNS text
  LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_code text := '';
BEGIN
  FOR i IN 0..9 LOOP v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1); END LOOP;
  RETURN v_code;
END $$;

-- 3. Code lesen (auch ohne Sitzung), Beziehung des Aufrufers
CREATE OR REPLACE FUNCTION public.join_code_info(p_code text) RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_code public.tournament_join_codes; v_t public.tournaments;
  v_mem public.tournament_collaborators; v_req public.tournament_join_requests;
  v_uid uuid := auth.uid(); v_state text; v_rel text := 'none';
BEGIN
  SELECT * INTO v_code FROM public.tournament_join_codes WHERE code = upper(btrim(p_code));
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'invalid'); END IF;            -- @HE-103
  SELECT * INTO v_t FROM public.tournaments WHERE id = v_code.tournament_id;
  v_state := CASE WHEN public.tournament_closed_for_helpers(v_t.id) THEN 'closed'
                  WHEN v_code.revoked_at IS NOT NULL THEN 'rotated'
                  WHEN now() >= public.helper_code_cutoff(v_t.date) THEN 'expired'
                  ELSE 'open' END;
  IF v_uid IS NOT NULL AND public.is_real_account() THEN
    IF public.has_tournament_permission(v_t.id, 'manageHelpers') THEN v_rel := 'leader'; END IF;   -- @HE-091
  ELSIF v_uid IS NOT NULL THEN
    SELECT * INTO v_mem FROM public.tournament_collaborators
     WHERE tournament_id = v_t.id AND user_id = v_uid AND role IN ('helper', 'viewer');
    IF FOUND THEN
      v_rel := CASE WHEN v_mem.declined_at IS NOT NULL THEN 'revoked'
                    WHEN v_mem.role = 'viewer' THEN 'viewer' ELSE 'accepted' END;      -- @HE-037 @HE-095 @HE-098
    ELSE
      SELECT * INTO v_req FROM public.tournament_join_requests
       WHERE tournament_id = v_t.id AND device_user_id = v_uid ORDER BY created_at DESC LIMIT 1;
      IF FOUND THEN
        IF v_req.status = 'pending' AND (now() >= public.helper_code_cutoff(v_t.date)
                                         OR public.tournament_closed_for_helpers(v_t.id)) THEN
          UPDATE public.tournament_join_requests SET status = 'expired' WHERE id = v_req.id;  -- @HE-011
          v_req.status := 'expired';
        END IF;
        v_rel := CASE
          WHEN v_req.status = 'accepted' THEN 'revoked'          -- M2(b): angenommen, Mitgliedschaft fehlt -> kein Zugang
          WHEN v_req.status = 'declined' AND v_req.decline_reason = 'rotated'
               AND v_req.code <> v_code.code THEN 'none'          -- S1/@HE-102: Ablehnung durch Erneuern sperrt den neuen Code nicht
          ELSE v_req.status END;                                -- pending|declined|expired
      END IF;
    END IF;
  END IF;
  IF v_state <> 'open' AND v_rel = 'none' THEN
    RETURN jsonb_build_object('state', v_state);                                       -- kein Turniername (@HE-004, @HE-076)
  END IF;
  RETURN jsonb_build_object(
    'state', v_state, 'relation', v_rel,
    'tournament', jsonb_build_object('id', v_t.id, 'title', v_t.title, 'date', v_t.date),
    'shareCode', CASE WHEN v_t.is_public THEN v_t.share_code END,                      -- Weg zur Zuschauer-Ansicht @HE-033
    'field', CASE WHEN v_rel IN ('accepted', 'viewer') THEN v_mem.allowed_fields[1] END,
    'checkNumber', CASE WHEN v_rel = 'pending' THEN v_req.check_number END);
END $$;

-- 4. Anfrage (nur Geraetesitzung); Pruefzahl aus den freien Werten des Turniers (M3/@HE-101)
CREATE OR REPLACE FUNCTION public.request_helper_access(p_code text, p_display_name text, p_device_label text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  c_hidden constant text :=                                                            -- S-4, wie die Tabellen-CHECKs
    '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]';
  v_info jsonb; v_name text := btrim(p_display_name); v_code text := upper(btrim(p_code)); v_t uuid; v_check smallint;
  v_label text; v_done boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN' USING ERRCODE = '42501'; END IF;
  IF public.is_real_account() THEN RETURN jsonb_build_object('result', 'ACCOUNT_SESSION'); END IF;   -- @HE-089, @HE-079
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 OR v_name ~ c_hidden THEN
    RAISE EXCEPTION 'INVALID_NAME' USING ERRCODE = '22023';
  END IF;
  v_label := left(nullif(btrim(regexp_replace(coalesce(p_device_label, ''), c_hidden, '', 'g')), ''), 40);   -- S3, S-4
  v_info := public.join_code_info(p_code);
  IF v_info ->> 'relation' IN ('accepted', 'viewer', 'pending', 'declined', 'revoked') THEN
    RETURN v_info || jsonb_build_object('result', 'EXISTING');                         -- @HE-095, @HE-037, @HE-015 (erneut)
  END IF;
  IF v_info ->> 'state' <> 'open' THEN RETURN jsonb_build_object('result', upper(v_info ->> 'state')); END IF;
  v_t := (v_info -> 'tournament' ->> 'id')::uuid;
  -- K-4: Code bis zum Ende dieser Anfrage gegen gleichzeitiges Erneuern sperren; schon erneuert -> ROTATED
  PERFORM 1 FROM public.tournament_join_codes WHERE code = v_code AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'ROTATED'); END IF;
  FOR i IN 1..5 LOOP
    SELECT n INTO v_check FROM generate_series(10, 99) n
     WHERE n NOT IN (SELECT check_number FROM public.tournament_join_requests
                      WHERE tournament_id = v_t AND status = 'pending')
     ORDER BY random() LIMIT 1;
    IF v_check IS NULL THEN RETURN jsonb_build_object('result', 'BUSY'); END IF;     -- 90 offene Anfragen (technische Grenze)
    BEGIN
      INSERT INTO public.tournament_join_requests (tournament_id, code, device_user_id, display_name, device_label, check_number)
      VALUES (v_t, v_code, auth.uid(), v_name, v_label, v_check)
      ON CONFLICT (tournament_id, device_user_id) WHERE status = 'pending' DO NOTHING;
      v_done := true;
      EXIT;
    EXCEPTION WHEN unique_violation THEN NULL;                                         -- Pruefzahl gleichzeitig vergeben
    END;
  END LOOP;
  IF NOT v_done THEN RETURN jsonb_build_object('result', 'BUSY'); END IF;            -- S-3: nie PENDING ohne Zeile
  RETURN public.join_code_info(p_code) || jsonb_build_object('result', 'PENDING');
END $$;

-- 5. Zugangsstatus des Geraets (Polling 2 s; @HE-055 binnen 3 s, @OB-053) + "zuletzt gesehen" (@HE-052)
CREATE OR REPLACE FUNCTION public.helper_access_status(p_tournament_id uuid) RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL OR public.is_real_account() THEN RETURN jsonb_build_object('relation', 'none'); END IF;
  UPDATE public.tournament_join_requests SET last_seen_at = now()
   WHERE tournament_id = p_tournament_id AND device_user_id = auth.uid() AND status = 'accepted'
     AND (last_seen_at IS NULL OR last_seen_at < now() - interval '30 seconds');
  SELECT r.code INTO v_code FROM public.tournament_join_requests r
   WHERE r.tournament_id = p_tournament_id AND r.device_user_id = auth.uid() ORDER BY r.created_at DESC LIMIT 1;
  IF v_code IS NULL THEN RETURN jsonb_build_object('relation', 'none'); END IF;
  RETURN public.join_code_info(v_code) || jsonb_build_object('closed', public.tournament_closed_for_helpers(p_tournament_id));
END $$;

-- 6. Code anzeigen / erneuern (Turnierleitung, echtes Konto, manageHelpers)
CREATE OR REPLACE FUNCTION public.ensure_helper_code(p_tournament_id uuid) RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_code text; v_date date;
BEGIN
  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF public.tournament_closed_for_helpers(p_tournament_id) THEN RETURN jsonb_build_object('result', 'CLOSED'); END IF;
  SELECT code INTO v_code FROM public.tournament_join_codes WHERE tournament_id = p_tournament_id AND revoked_at IS NULL;
  WHILE v_code IS NULL LOOP                                     -- kein Turnier-Lock (Sperrreihenfolge GA4 R-GA4v2-8)
    BEGIN
      INSERT INTO public.tournament_join_codes (code, tournament_id, created_by)
      VALUES (public.generate_helper_code(), p_tournament_id, auth.uid()) RETURNING code INTO v_code;
    EXCEPTION WHEN unique_violation THEN                        -- Code-Kollision oder zweites Leitungsgeraet war schneller
      SELECT code INTO v_code FROM public.tournament_join_codes WHERE tournament_id = p_tournament_id AND revoked_at IS NULL;
    END;
  END LOOP;
  SELECT date INTO v_date FROM public.tournaments WHERE id = p_tournament_id;
  RETURN jsonb_build_object('result', 'OK', 'code', v_code, 'validUntil', public.helper_code_cutoff(v_date),
    'openRequests', (SELECT count(*) FROM public.tournament_join_requests                -- S4: wie list_helper_access
                      WHERE tournament_id = p_tournament_id AND status = 'pending'
                        AND now() < public.helper_code_cutoff(v_date)));
END $$;

CREATE OR REPLACE FUNCTION public.rotate_helper_code(p_tournament_id uuid, p_open_requests text DEFAULT 'keep')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_declined integer := 0;
BEGIN
  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_open_requests NOT IN ('keep', 'decline') THEN RAISE EXCEPTION 'INVALID_OPTION' USING ERRCODE = '22023'; END IF;
  UPDATE public.tournament_join_codes SET revoked_at = now(), revoked_by = auth.uid()
   WHERE tournament_id = p_tournament_id AND revoked_at IS NULL;                      -- @HE-007; Zugaenge bleiben
  IF p_open_requests = 'decline' THEN                                                 -- @HE-008; S1/@HE-102: Grund 'rotated'
    UPDATE public.tournament_join_requests
       SET status = 'declined', decline_reason = 'rotated', decided_at = now(), decided_by = auth.uid()
     WHERE tournament_id = p_tournament_id AND status = 'pending';
    GET DIAGNOSTICS v_declined = ROW_COUNT;
  END IF;
  RETURN public.ensure_helper_code(p_tournament_id) || jsonb_build_object('declined', v_declined);
END $$;

-- 7. Uebersicht fuer die Turnierleitung (@HE-021 @HE-052 @HE-075 @HE-077 @HE-106; Polling 2 s) inkl. "steuert" (M9)
--    S-2: sameName = offene Anfragen + bestehende Zugaenge (label, angenommen, nicht entzogen) + per Tipp abgelehnte
--    Anfragen gleichen Namens (Vergleich lower/btrim); sameNamePending nur die offenen (Text @HE-021).
CREATE OR REPLACE FUNCTION public.list_helper_access(p_tournament_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_date date;
BEGIN
  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT date INTO v_date FROM public.tournaments WHERE id = p_tournament_id;
  RETURN jsonb_build_object(
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.display_name, 'deviceLabel', r.device_label, 'checkNumber', r.check_number,
        'createdAt', r.created_at,
        'sameName', s.pending + s.members + s.declined, 'sameNamePending', s.pending,
        'sameNameMember', s.member, 'sameNameDeclinedAt', s.declined_at)
        ORDER BY r.created_at)
      FROM public.tournament_join_requests r
      CROSS JOIN LATERAL (SELECT lower(btrim(r.display_name)) AS n) k
      CROSS JOIN LATERAL (SELECT
          (SELECT count(*) FROM public.tournament_join_requests r2
            WHERE r2.tournament_id = r.tournament_id AND r2.status = 'pending'
              AND now() < public.helper_code_cutoff(v_date) AND lower(btrim(r2.display_name)) = k.n) AS pending,
          (SELECT count(*) FROM public.tournament_collaborators c2
            WHERE c2.tournament_id = r.tournament_id AND c2.accepted_at IS NOT NULL AND c2.declined_at IS NULL
              AND lower(btrim(c2.label)) = k.n) AS members,
          (SELECT count(*) FROM public.tournament_join_requests r3
            WHERE r3.tournament_id = r.tournament_id AND r3.status = 'declined' AND r3.decline_reason = 'manual'
              AND lower(btrim(r3.display_name)) = k.n) AS declined,
          (SELECT max(r3.decided_at) FROM public.tournament_join_requests r3
            WHERE r3.tournament_id = r.tournament_id AND r3.status = 'declined' AND r3.decline_reason = 'manual'
              AND lower(btrim(r3.display_name)) = k.n) AS declined_at,
          (SELECT jsonb_build_object('deviceLabel', rm.device_label, 'acceptedAt', c2.accepted_at)
             FROM public.tournament_collaborators c2
             LEFT JOIN public.tournament_join_requests rm ON rm.member_id = c2.id
            WHERE c2.tournament_id = r.tournament_id AND c2.accepted_at IS NOT NULL AND c2.declined_at IS NULL
              AND lower(btrim(c2.label)) = k.n
            ORDER BY c2.accepted_at DESC LIMIT 1) AS member) s
     WHERE r.tournament_id = p_tournament_id AND r.status = 'pending'
       AND now() < public.helper_code_cutoff(v_date)), '[]'::jsonb),
    'members', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'memberId', c.id, 'name', c.label, 'deviceLabel', r.device_label, 'field', c.allowed_fields[1],
        'mode', c.role, 'revokedAt', c.declined_at, 'acceptedAt', c.accepted_at, 'lastSeenAt', r.last_seen_at,
        'controls', coalesce((SELECT jsonb_agg(fc.field ORDER BY fc.field) FROM public.field_control fc
                               WHERE fc.tournament_id = c.tournament_id AND fc.holder_user_id = c.user_id), '[]'::jsonb))
        ORDER BY c.accepted_at)
      FROM public.tournament_collaborators c
      JOIN public.tournament_join_requests r ON r.member_id = c.id
     WHERE c.tournament_id = p_tournament_id), '[]'::jsonb));
END $$;

-- 7b. Zaehler fuer den Cockpit-Hinweis (@HE-051, S5: schlank statt list_helper_access alle 2 s)
CREATE OR REPLACE FUNCTION public.helper_request_count(p_tournament_id uuid) RETURNS integer
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT count(*) FROM public.tournament_join_requests r JOIN public.tournaments t ON t.id = r.tournament_id
           WHERE r.tournament_id = p_tournament_id AND r.status = 'pending' AND now() < public.helper_code_cutoff(t.date));
END $$;

-- 8. Entscheiden (Wettlauf: Zeilensperre, erste Entscheidung gilt @HE-006). S-1/@HE-105: Zulassen nur mit der
--    Pruefzahl der Anfrage; falsche oder fehlende Zahl -> CHECK_MISMATCH, nichts aendert sich. Ablehnen ohne Zahl.
CREATE OR REPLACE FUNCTION public.decide_join_request(p_request_id uuid, p_accept boolean, p_field integer DEFAULT NULL,
                                                      p_check_number smallint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_req public.tournament_join_requests; v_t public.tournaments; v_member uuid; v_by text;
BEGIN
  SELECT * INTO v_req FROM public.tournament_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.is_real_account() AND public.has_tournament_permission(v_req.tournament_id, 'manageHelpers')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';                        -- kein Existenz-Orakel
  END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = v_req.tournament_id;
  IF v_req.status <> 'pending' THEN
    SELECT nullif(btrim(p.display_name), '') INTO v_by FROM public.profiles p WHERE p.id = v_req.decided_by;
    RETURN jsonb_build_object('result', 'ALREADY_DECIDED', 'status', v_req.status, 'decidedBy', v_by);
  END IF;
  IF p_accept AND p_check_number IS DISTINCT FROM v_req.check_number THEN
    RETURN jsonb_build_object('result', 'CHECK_MISMATCH');                             -- S-1: keine Aenderung
  END IF;
  IF now() >= public.helper_code_cutoff(v_t.date) OR public.tournament_closed_for_helpers(v_t.id) THEN
    UPDATE public.tournament_join_requests SET status = 'expired' WHERE id = v_req.id;
    RETURN jsonb_build_object('result', 'EXPIRED');                                    -- @HE-011
  END IF;
  IF p_accept THEN
    IF p_field IS NOT NULL AND (p_field < 1 OR p_field > v_t.number_of_fields) THEN
      RAISE EXCEPTION 'INVALID_FIELD' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.tournament_collaborators
      (tournament_id, user_id, role, label, allowed_fields, invited_by, invited_at, accepted_at)
    VALUES (v_t.id, v_req.device_user_id, 'helper', v_req.display_name,
            CASE WHEN p_field IS NULL THEN NULL ELSE ARRAY[p_field] END, auth.uid(), now(), now())
    RETURNING id INTO v_member;                        -- protect_device_roles: Definer erlaubt; @HE-062 nur ueber Anfrage
  END IF;
  UPDATE public.tournament_join_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         decline_reason = CASE WHEN p_accept THEN NULL ELSE 'manual' END,
         decided_at = now(), decided_by = auth.uid(), member_id = v_member
   WHERE id = v_req.id;
  RETURN jsonb_build_object('result', 'OK', 'memberId', v_member);
END $$;

-- 9. Entziehen / nur zusehen (auch Co-Admin; nur Zugaenge aus dem QR-Beitritt; nie Co-Admin @HE-084)
CREATE OR REPLACE FUNCTION public.change_helper_access(p_member_id uuid, p_action text) RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_mem public.tournament_collaborators;
BEGIN
  SELECT c.* INTO v_mem FROM public.tournament_collaborators c
   WHERE c.id = p_member_id AND c.role IN ('helper', 'viewer')
     AND EXISTS (SELECT 1 FROM public.tournament_join_requests r WHERE r.member_id = c.id)
   FOR UPDATE;
  IF NOT FOUND OR NOT (public.is_real_account() AND public.has_tournament_permission(v_mem.tournament_id, 'manageHelpers')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'revoke' THEN                                                         -- @HE-055 Z.1, @HE-056, @HE-080
    UPDATE public.tournament_collaborators SET declined_at = coalesce(declined_at, now()) WHERE id = p_member_id;
  ELSIF p_action = 'watch_only' THEN                                                  -- @HE-055 Z.2 "zum Zuschauer"
    UPDATE public.tournament_collaborators SET role = 'viewer' WHERE id = p_member_id AND declined_at IS NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
  END IF;
  -- K-2: Feldsteuerung des Geraets freigeben (Halterwechsel -> Epoche +1), die Uebersicht zeigt nicht weiter "steuert"
  UPDATE public.field_control
     SET holder_user_id = NULL, holder_device_id = NULL, holder_device_label = NULL, epoch = epoch + 1, claimed_at = now()
   WHERE tournament_id = v_mem.tournament_id AND holder_user_id = v_mem.user_id;
  RETURN jsonb_build_object('result', 'OK');
END $$;

-- 10. Geraet im Verlauf (@HE-081; additiv zu match_event_author_names, gleiche Lese-Regel)
CREATE OR REPLACE FUNCTION public.match_event_author_devices(p_match_id uuid)
RETURNS TABLE (event_id uuid, device_label text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT a.event_id, r.device_label
    FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id AND t.deleted_at IS NULL
    JOIN public.match_events e ON e.match_id = m.id AND e.event_format IS NOT NULL
    JOIN public.match_event_authors a ON a.event_id = e.id
    JOIN public.tournament_join_requests r
      ON r.tournament_id = t.id AND r.device_user_id = a.user_id AND r.status = 'accepted'
   WHERE m.id = p_match_id AND public.has_tournament_permission(t.id, 'writeMatchData')
   ORDER BY e.seq
$$;

-- 10b. Geraete-Mitgliedschaft? (fuer die Loesch-Policy M2 und den Rollen-Schutz K-3; Aufrufer hat kein Recht auf
--      tournament_join_requests). Als RPC fuer authenticated aufrufbar (Policy im Aufruferkontext); verraet fuer eine
--      bekannte Mitglieds-UUID nur "aus dem QR-Beitritt" -- folgenlos, die UUID ist nicht ratbar (Kurzblick 2.1).
CREATE OR REPLACE FUNCTION public.is_device_membership(p_member_id uuid, p_role text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT p_role IN ('helper', 'screen')
      OR EXISTS (SELECT 1 FROM public.tournament_join_requests r WHERE r.member_id = p_member_id)
$$;

-- 11. Bestehende Objekte
-- 11a. protect_collaborator_row: Rumpf woertlich aus 20260924_003 (Abschnitt 4) + EINE Zeile nach der tournament_id-Pruefung
--      (Definer-Durchgang). Wer als Definer tournament_collaborators schreibt, steht in der Positivliste der Assertion
--      `definer-writers-tournament-collaborators` (M4a); B-20 erweitert sie ausdruecklich.
CREATE OR REPLACE FUNCTION "public"."protect_collaborator_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- K3: tournament_id ist ein Parent-Schlüssel, kein Gegenstand irgendeiner Mitarbeiter-
  -- Verwaltung. Diese Prüfung steht VOR der Eigentümer-Ausnahme unten und gilt für ALLE
  -- Aufrufer, auch den Turnier-Eigentümer selbst -- genau das hat 003 versäumt ("IF
  -- user_owns_tournament(OLD.tournament_id) THEN RETURN NEW" prüfte nur OLD, nie NEW). Ein
  -- Eigentümer, der die eigene tournament_id einer Mitarbeiterzeile per UPDATE auf ein fremdes
  -- Turnier umhängt, wird dadurch selbst zum Co-Admin dieses fremden Turniers (K3). Kein
  -- App-Pfad ändert tournament_id einer bestehenden Collaborator-Zeile -- RAISE, nicht
  -- stillschweigend beibehalten wie bei protect_owner_id (K1): ein Fehler hier ist sichtbar,
  -- ein stilles Beibehalten würde einen Fehler der App verdecken.
  IF NEW.tournament_id IS DISTINCT FROM OLD.tournament_id THEN
    RAISE EXCEPTION 'Nicht erlaubt: tournament_id einer Mitarbeiter-Zeile ist unveraenderlich.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;  -- A-16 Definer-Durchgang

  -- Turnier-Eigentümer verwaltet seine Mitarbeiter: uneingeschränkt (wie bisher).
  -- WICHTIG: OLD/NEW sind plpgsql-Record-Variablen, keine SQL-Tabellenreferenzen — NIE als
  -- "OLD"/"NEW" (doppelt gequotet) schreiben, sonst sucht Postgres eine Tabelle namens OLD/NEW
  -- im FROM-Klausel-Kontext und scheitert mit "missing FROM-clause entry for table \"OLD\""
  -- (im Container reproduziert, bevor dieser Kommentar geschrieben wurde — Warnung aus 003
  -- unverändert übernommen).
  IF "public"."user_owns_tournament"(OLD.tournament_id) THEN
    RETURN NEW;
  END IF;

  -- Nicht Eigentümer: einzig erlaubter Vorgang ist das Annehmen der EIGENEN, noch nicht
  -- angenommenen Einladung -- exakt das Spaltenmuster aus
  -- invitationService.ts#acceptInvitation (mapInvitationAcceptToSupabase): user_id,
  -- accepted_at, use_count. Alle anderen Spalten müssen unverändert bleiben. tournament_id
  -- ist durch die Prüfung ganz oben bereits für ALLE Aufrufer erzwungen, taucht deshalb hier
  -- nicht mehr im AND-Katalog auf (wäre nach der ersten RAISE ohnehin unerreichbar).
  --
  -- L5-Präzisierung: use_count muss exakt um 1 steigen (App schreibt "invitation.useCount + 1",
  -- vor dieser Migration gegen mapInvitationAcceptToSupabase/acceptInvitation geprüft) --
  -- vorher war jeder Wert erlaubt, weil use_count in 003 im AND-Katalog schlicht fehlte.
  -- accepted_at darf höchstens 1 Minute in der Zukunft liegen (Uhrenabweichung zwischen Client
  -- und DB-Server), nicht beliebig weit (etwa ein Datum in ferner Zukunft, vorher möglich).
  --
  -- R7 (F4, task-R3-review.md): eine bereits widerrufene ODER abgelaufene Einladung lässt sich
  -- damit nicht mehr annehmen. "OLD.declined_at IS NULL" -- der Eigentümer hat
  -- deactivateInvitation() nicht aufgerufen. "OLD.expires_at IS NULL OR OLD.expires_at > now()"
  -- -- keine Ablaufzeit gesetzt, oder sie liegt noch in der Zukunft. Beide Spalten stehen bereits
  -- im NOT-DISTINCT-Katalog unten (dürfen sich beim Annehmen nicht ändern) -- diese zwei neuen
  -- Zeilen prüfen zusätzlich ihren WERT vor der Annahme, nicht nur, dass er gleich bleibt.
  IF OLD.user_id IS NULL
     AND OLD.accepted_at IS NULL
     AND OLD.declined_at IS NULL
     AND (OLD.expires_at IS NULL OR OLD.expires_at > now())
     AND NEW.user_id = ( SELECT "auth"."uid"() )
     AND NEW.accepted_at IS NOT NULL
     AND NEW.accepted_at <= now() + interval '1 minute'
     AND NEW.use_count = COALESCE(OLD.use_count, 0) + 1
     AND NEW.id = OLD.id
     AND NEW.role = OLD.role
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.invite_email IS NOT DISTINCT FROM OLD.invite_email
     AND NEW.invite_code IS NOT DISTINCT FROM OLD.invite_code
     AND NEW.invited_at IS NOT DISTINCT FROM OLD.invited_at
     AND NEW.invited_by IS NOT DISTINCT FROM OLD.invited_by
     AND NEW.declined_at IS NOT DISTINCT FROM OLD.declined_at
     AND NEW.allowed_fields IS NOT DISTINCT FROM OLD.allowed_fields
     AND NEW.allowed_groups IS NOT DISTINCT FROM OLD.allowed_groups
     AND NEW.team_ids IS NOT DISTINCT FROM OLD.team_ids
     AND NEW.label IS NOT DISTINCT FROM OLD.label
     AND NEW.max_uses IS NOT DISTINCT FROM OLD.max_uses
     AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Nicht erlaubt: nur der Turnier-Eigentuemer darf Mitarbeiter-Zeilen aendern (Ausnahme: das Annehmen der eigenen, noch offenen, nicht widerrufenen und nicht abgelaufenen Einladung).'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;


-- 11b. Geraete-Zugaenge werden nur entzogen, nie geloescht -- auch nicht vom Eigentuemer (M2a/@HE-104; Name im Verlauf
--      bleibt). Konto-Zeilen wie bisher: eigene Zeile mit echtem Konto oder manageMembers.
DROP POLICY IF EXISTS collaborators_delete_v3 ON public.tournament_collaborators;
DROP POLICY IF EXISTS collaborators_delete_v4 ON public.tournament_collaborators;     -- M1: zweites Einspielen
CREATE POLICY collaborators_delete_v4 ON public.tournament_collaborators FOR DELETE TO authenticated
  USING (NOT public.is_device_membership(id, role)
         AND ((user_id = (SELECT auth.uid()) AND public.is_real_account())
              OR public.has_tournament_permission(tournament_id, 'manageMembers')));

-- 11c. K-3: Die Rolle einer Zeile aus dem QR-Beitritt (auch herabgestuft auf viewer) aendert ueber die Schnittstelle
--      niemand, auch nicht der Eigentuemer; nur change_helper_access (Definer). helper/screen deckt schon
--      protect_device_roles (A-27) ab, dieser Trigger schliesst viewer -> co-admin/collaborator (Sicherheits-Review V13b).
CREATE OR REPLACE FUNCTION public.protect_helper_access_row() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.role IS DISTINCT FROM OLD.role
     AND public.is_device_membership(OLD.id, OLD.role) THEN
    RAISE EXCEPTION 'Nicht erlaubt: die Rolle eines Helfer-Zugangs aus dem QR-Beitritt aendert sich nur ueber "Team & Helfer".'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_helper_access_row ON public.tournament_collaborators;
CREATE TRIGGER protect_helper_access_row BEFORE UPDATE ON public.tournament_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.protect_helper_access_row();

-- 12. Rechte
REVOKE ALL ON FUNCTION public.helper_code_cutoff(date), public.tournament_closed_for_helpers(uuid),
  public.generate_helper_code(), public.protect_helper_access_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_code_info(text), public.request_helper_access(text, text, text),
  public.helper_access_status(uuid), public.ensure_helper_code(uuid), public.rotate_helper_code(uuid, text),
  public.list_helper_access(uuid), public.helper_request_count(uuid),
  public.decide_join_request(uuid, boolean, integer, smallint),
  public.change_helper_access(uuid, text), public.match_event_author_devices(uuid),
  public.is_device_membership(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_code_info(text) TO anon, authenticated;         -- Scan ohne Sitzung (@HE-033)
GRANT EXECUTE ON FUNCTION public.request_helper_access(text, text, text), public.helper_access_status(uuid),
  public.ensure_helper_code(uuid), public.rotate_helper_code(uuid, text), public.list_helper_access(uuid),
  public.helper_request_count(uuid), public.decide_join_request(uuid, boolean, integer, smallint),
  public.change_helper_access(uuid, text), public.match_event_author_devices(uuid),
  public.is_device_membership(uuid, text) TO authenticated;                         -- letzte: Policy/Trigger im Aufruferkontext
COMMIT;
