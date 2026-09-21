-- ============================================
-- 20260921_001: Datenbank-Backstop für die Freigabe-vor-Öffentlich-Regel
-- ============================================
--
-- `make_tournament_public` lehnt nicht freigegebene Turniere bereits ab (siehe
-- 20260918_002_make_public_refuses_drafts.sql). Diese Prüfung lässt sich aber umgehen:
-- `updateTournamentMetadata` schreibt `is_public` und `share_code` als gewöhnliche Spalten,
-- ohne diese Kontrolle. Ein Client, der noch ein älteres Bundle ausführt — realistisch hier,
-- veraltete Service-Worker-Caches sind ein dokumentiertes Produktionsproblem —, fällt dann
-- auf lokales Teilen zurück und reiht eine Metadaten-Mutation ein, die die Datenbank anstandslos
-- annimmt und damit den Entwurf trotzdem veröffentlicht.
--
-- Fix: ein Trigger, der unabhängig davon greift, welche Client-Version schreibt.
--
-- Prüft NUR beim ÜBERGANG nach öffentlich (INSERT mit is_public=true, oder UPDATE von
-- is_public != true auf true), nicht bei jedem Update einer bereits öffentlichen Zeile —
-- sonst wäre eine Altzeile ohne publishedAt (z.B. vor Migration 20260918_003) dauerhaft
-- unveränderbar, selbst für Updates, die is_public gar nicht anfassen.
--
-- `make_tournament_public` bleibt unblockiert: Die Funktion prüft die Anwesenheit von
-- config->'publishedAt' VOR dem UPDATE, das is_public setzt (siehe 20260918_002) — das
-- UPDATE selbst rührt config nicht an, der Key ist also bereits vorhanden, wenn der Trigger
-- feuert.
--
-- Fehlercode bewusst 'HF001', NICHT aus dem 'PT'-Namespace: PostgREST interpretiert
-- SQLSTATEs der Form PTxyz als HTTP-Status-Override, was code/message unterwegs zerstört.
-- Siehe Kommentar in 20260918_002_make_public_refuses_drafts.sql und den Test in
-- OfflineRepository.makePublic.test.ts, der genau das pinnt.

CREATE OR REPLACE FUNCTION public.enforce_release_before_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Nur beim ÜBERGANG nach öffentlich prüfen, nicht bei jedem Update einer bereits
  -- öffentlichen Zeile — sonst wäre eine Altzeile ohne publishedAt dauerhaft unveränderbar.
  IF NEW.is_public IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.is_public IS DISTINCT FROM TRUE)
     AND NOT (COALESCE(NEW.config, '{}'::jsonb) ? 'publishedAt')
  THEN
    RAISE EXCEPTION 'Tournament has not been released yet and cannot be made public'
      USING ERRCODE = 'HF001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tournaments_enforce_release_before_public ON public.tournaments;
CREATE TRIGGER tournaments_enforce_release_before_public
  BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_release_before_public();
