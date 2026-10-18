-- supabase/migrations/20261028_006_event_author_names.sql
-- UR (Befund C-EREIGNIS-OHNE-URHEBER, brief-UR.md): Namen der Urheber von Spiel-Eintraegen lesen
-- (@FU-080 "Ergebnis eingetragen von Olli", @FU-082 "... von Olli geaendert ...", Randbedingung @FU-065).
--
-- Der Urheber steht schon in match_event_authors (append_match_events, 20261028_003). Es fehlt eine Lese-
-- regel fuer den NAMEN, die fuer alle berechtigten Rollen gleich ist: Mitglieder koennen Profile und
-- Mitglieder-Zeilen anderer Mitglieder per RLS nicht lesen (profiles_select_related, collaborators_select_v3).
--
-- Inhalt:
--   1. public.match_event_author_names(uuid): je Engine-Eintrag eines Spiels Name und Rolle des Urhebers.
--      Name: Eigentuemer -> profiles.display_name; Mitglied -> tournament_collaborators.label, sonst
--      profiles.display_name; nie E-Mail. Nur fuer Turnierleitung und Helfer (writeMatchData, @FU-065);
--      alle anderen bekommen 0 Zeilen (kein Existenz-Orakel). Papierkorb -> 0 Zeilen.
--   2. Rechte: EXECUTE nur authenticated.
--
-- Nicht geaendert: append_match_events, match_event_authors, Policies, Daten. Idempotent (CREATE OR
-- REPLACE, REVOKE/GRANT). Portabel: reines SQL.
--
-- RUECKWEG (zuerst die App zurueck -- die neue App ruft die Funktion; ohne sie zeigt sie Eintraege ohne
-- Namen, bricht aber nicht -- DANN die DB, eigene Datei, ein Block):
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   DROP FUNCTION IF EXISTS public.match_event_author_names(uuid);
--   COMMIT;
--   Danach: zwei Assertions + PRIVILEGE_ASSERTION_NAMES zuruecknehmen, Drift-Check, Typen-PR.
--
-- Produktion: nur im DB-Fenster F2b durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (UR-sql-freigabe.md), Reihenfolge A-10 _005 -> UR _006 -> SW _007. Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.match_event_authors') IS NULL
     OR to_regclass('public.tournament_collaborators') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL THEN
    RAISE EXCEPTION '20261028_006_event_author_names: match_event_authors/Mitglieder/Profile/Rechte fehlen -- zuerst 20260924_001, 20260924_002 und 20260928_001 einspielen';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_event_author_names(p_match_id uuid)
RETURNS TABLE (event_id uuid, author_name text, author_role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.event_id,
         CASE
           WHEN a.user_id IS NOT NULL AND a.user_id = t.owner_id THEN nullif(btrim(p.display_name), '')
           ELSE coalesce(nullif(btrim(tc.label), ''), nullif(btrim(p.display_name), ''))
         END AS author_name,
         CASE
           WHEN a.user_id IS NOT NULL AND a.user_id = t.owner_id THEN 'owner'
           ELSE tc.role
         END AS author_role
    FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id AND t.deleted_at IS NULL
    JOIN public.match_events e ON e.match_id = m.id AND e.event_format IS NOT NULL
    JOIN public.match_event_authors a ON a.event_id = e.id
    LEFT JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN LATERAL (
      -- Auch beendete/abgelaufene Mitgliedschaften: alte Eintraege behalten ihren Namen.
      SELECT c.label, c.role
        FROM public.tournament_collaborators c
       WHERE c.tournament_id = t.id AND a.user_id IS NOT NULL AND c.user_id = a.user_id
       ORDER BY c.accepted_at DESC NULLS LAST, c.created_at DESC NULLS LAST
       LIMIT 1
    ) tc ON true
   WHERE m.id = p_match_id
     AND public.has_tournament_permission(t.id, 'writeMatchData')
   ORDER BY e.seq;
$$;

COMMENT ON FUNCTION public.match_event_author_names(uuid) IS
  'UR (C-EREIGNIS-OHNE-URHEBER, @FU-080/@FU-082/@FU-065): Name und Rolle des Urhebers je Engine-Eintrag eines
   Spiels. Nur fuer Turnierleitung und Helfer (writeMatchData); sonst 0 Zeilen. Name: Eigentuemer ->
   profiles.display_name, Mitglied -> tournament_collaborators.label, sonst display_name; nie E-Mail.
   SECURITY DEFINER, weil Mitglieder die Profile/Mitglieder-Zeilen anderer Mitglieder per RLS nicht lesen.';

REVOKE ALL ON FUNCTION public.match_event_author_names(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.match_event_author_names(uuid) TO authenticated;

COMMIT;
