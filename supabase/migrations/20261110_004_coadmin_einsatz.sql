-- supabase/migrations/20261110_004_coadmin_einsatz.sql
-- CA-2 (Paket "Co-Admin einsatzfaehig", plan-coadmin-einsatzfaehig.md § CA-2, review-plan-coadmin.md Auflagen 2-5):
-- die Co-Admin teilt online und sieht, ob die Monitore verbunden sind (@HE-085; Befunde C-SHARE und
-- C-HEARTBEAT-NUR-EIGENTUEMER; Vorschlaege NEU-CA3 "Wer das Turnier online teilen darf" und NEU-CA5 "Wer den
-- Verbindungsstatus der Monitore sieht"; Zusammenspiel @ZM-019, @HE-062 unveraendert).
--
-- Inhalt:
--   1. make_tournament_public, make_tournament_private, regenerate_share_code: statt "nur Eigentuemer"
--      (owner_id = auth.uid()) jetzt public.has_tournament_permission(tournament_id, 'tournamentSettings')
--      -- Eigentuemer mit echtem Konto und angenommene, nicht widerrufene Co-Admin. Nie: Helfer (collaborator),
--      Trainer, Zuschauer, Geraetesitzungen helper/screen, Eigentuemer mit anonymer Sitzung (A-27), offene
--      Einladung, widerrufene Mitgliedschaft, anon. Signaturen, Rueckgabe, SECURITY DEFINER, search_path,
--      Fehlertexte ("Not authorized to modify this tournament") und die Freigabe-Sperre HF001 (publishedAt)
--      unveraendert; Rumpf sonst woertlich aus der Live-Fassung (Baseline 00000000000000, Stand 20260918_002 bzw.
--      20260128_003).
--   2. make_tournament_public: Code bleibt beim erneuten Teilen (Auflage 5). Ist das Turnier schon oeffentlich und
--      hat einen Code, kommt genau dieser Code mit seinem Zeitpunkt zurueck -- kein Neuwuerfeln (ein gedruckter
--      Aushang/QR bleibt gueltig, auch wenn ein zweites Leitungsgeraet aus altem Stand "teilen" tippt). Die
--      Turnierzeile wird dafuer FOR UPDATE gelesen: zwei gleichzeitige Aufrufe ergeben denselben Code.
--      regenerate_share_code wuerfelt weiter immer neu, auch auf einem nicht oeffentlichen Turnier (Bestand,
--      Auflage 4).
--   3. monitor_heartbeats lesen: Policy owner_select_heartbeats (Baseline, nur Eigentuemer) ersetzt durch
--      heartbeats_select_v2 FOR SELECT TO authenticated USING has_tournament_permission(tournament_id,
--      'manageScreens') (Auflage 3). Realtime wertet dieselbe Policy aus. Schreiben unveraendert (nur ueber
--      record_monitor_heartbeat, SECURITY DEFINER).
--
-- Nicht geaendert: EXECUTE-Rechte der drei Funktionen (CREATE OR REPLACE behaelt die ACL), generate_share_code,
-- record_monitor_heartbeat, alle anderen Policies, rolePermissions.json/role_permissions. Keine Datenaenderung.
-- Idempotent: CREATE OR REPLACE, beide Policies per DROP POLICY IF EXISTS vor dem CREATE.
-- Kein Typen-PR noetig (Signaturen gleich).
--
-- RUECKWEG: eigene Datei <Datum>_<NNN>_coadmin_einsatz_rollback.sql (Anhang B von CA-2-sql-freigabe.md, erzeugt mit
-- `bash scripts/coadmin-einsatz-check.sh --print-rueckweg`), in EINEM Block: die drei Funktionen woertlich aus der
-- Baseline, Policy heartbeats_select_v2 weg, owner_select_heartbeats woertlich aus der Baseline. Die App braucht
-- dafuer keine Ruecknahme (sie faellt bei "Not authorized" auf den lokalen Rueckfall zurueck). Belegt in
-- scripts/coadmin-einsatz-check.sh (Kategorie X: Schema danach identisch zum Stand vorher).
--
-- Produktion: nur im DB-Fenster Do 22.10. durch den Controller nach Daniels Freigabe (CA-2-sql-freigabe.md),
-- Reihenfolge 20261110_001 -> 20261110_002 -> Hook an -> 20261110_003 -> diese Datei. Haengt fachlich nur an
-- _001 (Recht manageScreens) und _002 (is_real_account in has_tournament_permission), nicht an _003.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast): A-11 (_001, Recht manageScreens der Co-Admin) und A-27 (_002) eingespielt
-- ============================================================================================
DO $$
BEGIN
  IF to_regprocedure('public.is_real_account()') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regclass('public.monitor_heartbeats') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions
                     WHERE role = 'co-admin' AND permission = 'manageScreens')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions
                     WHERE role = 'co-admin' AND permission = 'tournamentSettings') THEN
    RAISE EXCEPTION '20261110_004_coadmin_einsatz: 20261110_001 (A-11, manageScreens) oder 20261110_002 (A-27, is_real_account) fehlen -- zuerst _001 und _002 einspielen';
  END IF;
END;
$$;

-- ============================================================================================
-- 1. Online teilen: Recht tournamentSettings statt "nur Eigentuemer"
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.make_tournament_public(tournament_id uuid)
RETURNS TABLE(share_code text, share_code_created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
  v_is_public BOOLEAN;
  v_existing_code TEXT;
  v_existing_created_at TIMESTAMPTZ;
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
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

  -- Code bleibt beim erneuten Teilen (CA-2, Auflage 5): schon oeffentlich mit Code -> genau diesen Code zurueck.
  -- FOR UPDATE: ein gleichzeitiger zweiter Aufruf wartet und sieht danach den Code des ersten.
  SELECT t.is_public, t.share_code, t.share_code_created_at
    INTO v_is_public, v_existing_code, v_existing_created_at
    FROM tournaments t
   WHERE t.id = tournament_id
   FOR UPDATE;
  IF v_is_public AND v_existing_code IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_code, v_existing_created_at;
    RETURN;
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

CREATE OR REPLACE FUNCTION public.make_tournament_private(tournament_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
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

CREATE OR REPLACE FUNCTION public.regenerate_share_code(tournament_id uuid)
RETURNS TABLE(share_code text, share_code_created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
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

-- ============================================================================================
-- 2. Lebenszeichen der Monitore lesen: Recht manageScreens statt "nur Eigentuemer"
-- ============================================================================================
DROP POLICY IF EXISTS owner_select_heartbeats ON public.monitor_heartbeats;
DROP POLICY IF EXISTS heartbeats_select_v2 ON public.monitor_heartbeats;
CREATE POLICY heartbeats_select_v2 ON public.monitor_heartbeats
  FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageScreens'));

COMMENT ON POLICY heartbeats_select_v2 ON public.monitor_heartbeats IS
  'CA-2 (NEU-CA5, Befund C-HEARTBEAT-NUR-EIGENTUEMER): Lebenszeichen der Monitore liest, wer manageScreens hat
   (Eigentuemer mit echtem Konto, Co-Admin). Ersetzt owner_select_heartbeats. Schreiben nur ueber
   record_monitor_heartbeat (SECURITY DEFINER).';

COMMIT;
