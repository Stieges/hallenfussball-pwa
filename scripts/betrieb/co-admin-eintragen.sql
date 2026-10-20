-- ====================================================================================================
-- co-admin-eintragen.sql -- Betreiber-Vorlage: eine Co-Admin in ein Turnier eintragen und wieder austragen
-- (@HE-085, dazu @HE-084, @HE-062, @W5-026; Paket CA, Task CA-1)
--
-- WER/WO: der Betreiber, im Supabase-Dashboard unter "SQL Editor" (laeuft dort als Rolle postgres).
-- Anleitung in Alltagssprache: docs/anleitungen/co-admin-eintragen.md
-- Geprueft wird diese Datei von scripts/coadmin-vorlage-check.sh -- das Skript liest die Bloecke unten
-- zwischen den "##### BLOCK n"-Zeilen. Aenderungen hier immer mit dem Skript pruefen.
--
-- VORWEG (kein SQL): Dashboard > Authentication > Users > Add user > Create new user, E-Mail und
-- Start-Passwort, "Auto Confirm User" AN, optional User Metadata {"name":"Maria"}.
--
-- PLATZHALTER (nur im Editor ersetzen, nie in dieser Datei im Repo):
--   <turnier-id>  die Kennung des Turniers (Block 0a des Turniers zeigt sie, oder aus der Adresse in der App)
--   <mail>        die E-Mail-Adresse des Kontos der Co-Admin (genau wie im Dashboard angelegt)
-- Beides jeweils in ALLEN Bloecken ersetzen (Suchen und Ersetzen im Editor: Strg+H bzw. Cmd+Option+F).
--
-- ARBEITSWEISE IM EDITOR: Der Editor zeigt nur das Ergebnis der LETZTEN Abfrage eines Laufs. Deshalb
-- jeweils nur EINE Abfrage markieren und ausfuehren (0a, dann 0b, dann 0c ...); Block 1 ist ein einziger
-- Befehl und kann komplett markiert und ausgefuehrt werden.
--
-- WICHTIG: Es gibt absichtlich KEIN UPDATE der Rolle. Der Schutz-Trigger protect_collaborator_row laesst
-- Aenderungen nur ueber die App-Anmeldung des Eigentuemers zu; im Editor wird ein UPDATE abgelehnt.
-- "Ersetzen" heisst hier: die eigene co-admin-Zeile loeschen und neu anlegen (Block 1 macht das).
-- Die Vorlage legt KEIN Konto an und loescht KEIN Konto. Sie traegt nur die eine genannte Person ein.
-- ====================================================================================================


-- ##### BLOCK 0 - Vorher pruefen (nur lesen)

-- 0a: Turnier. Erwartet: 1 Zeile, deleted_at leer. Titel laut vorlesen: Original oder Kopie?
SELECT t.id AS turnier_id, t.title, t.owner_id, t.deleted_at
  FROM public.tournaments t
 WHERE t.id = '<turnier-id>';

-- 0b: Konto. Erwartet: 1 Zeile, email_confirmed_at gesetzt, anonym = false.
SELECT u.id AS user_id, u.email_confirmed_at,
       coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false) AS anonym
  FROM auth.users u
 WHERE lower(u.email) = lower('<mail>');

-- 0c: Bestehende Zeile dieser Person im Turnier. Erwartet: 0 Zeilen (oder eine co-admin-Zeile, die ersetzt wird).
SELECT c.id, c.role, c.accepted_at, c.declined_at
  FROM public.tournament_collaborators c
 WHERE c.tournament_id = '<turnier-id>'
   AND c.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<mail>'));


-- ##### BLOCK 1 - Eintragen (eine Ausfuehrung; bricht bei jedem Zweifel ab, aendert dann nichts)
DO $$
DECLARE
  v_turnier    uuid := '<turnier-id>';
  v_mail       text := lower('<mail>');
  v_owner      uuid;
  v_user       uuid;
  v_bestaetigt timestamptz;
  v_anonym     boolean;
BEGIN
  SELECT t.owner_id INTO v_owner
    FROM public.tournaments t
   WHERE t.id = v_turnier AND t.deleted_at IS NULL;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Abbruch: Turnier % gibt es nicht oder es ist gelöscht.', v_turnier;
  END IF;

  SELECT u.id, u.email_confirmed_at, coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false)
    INTO v_user, v_bestaetigt, v_anonym
    FROM auth.users u
   WHERE lower(u.email) = v_mail;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Abbruch: Kein Konto mit dieser Mail. Erst im Dashboard anlegen (Authentication > Users > Add user, Auto Confirm User an).';
  END IF;
  IF v_bestaetigt IS NULL THEN
    RAISE EXCEPTION 'Abbruch: Das Konto ist nicht bestätigt (Auto Confirm User war aus).';
  END IF;
  IF v_anonym THEN
    RAISE EXCEPTION 'Abbruch: Das ist eine Gerätesitzung, kein Konto.';
  END IF;
  IF v_user = v_owner THEN
    RAISE EXCEPTION 'Abbruch: Das Konto gehört dem Eigentümer dieses Turniers.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_collaborators c
              WHERE c.tournament_id = v_turnier AND c.user_id = v_user AND c.role <> 'co-admin') THEN
    RAISE EXCEPTION 'Abbruch: Es gibt schon einen Eintrag mit anderer Rolle. Block 0c ansehen und entscheiden, nicht überschreiben.';
  END IF;

  -- Kein UPDATE: der Schutz-Trigger protect_collaborator_row erlaubt Änderungen nur dem Eigentümer über die App.
  -- Ersetzen = die eigene co-admin-Zeile (z. B. widerrufen) löschen und neu anlegen.
  DELETE FROM public.tournament_collaborators c
   WHERE c.tournament_id = v_turnier AND c.user_id = v_user AND c.role = 'co-admin';

  INSERT INTO public.tournament_collaborators
    (tournament_id, user_id, role, invited_by, invited_at, accepted_at)
  VALUES
    (v_turnier, v_user, 'co-admin', v_owner, now(), now());

  RAISE NOTICE 'Eingetragen: % als co-admin in %', v_user, v_turnier;
END
$$;


-- ##### BLOCK 2 - Nachher pruefen

-- 2a: Erwartet genau 1 Zeile: co-admin | angenommen = true | nicht_widerrufen = true | vom_eigentuemer = true
SELECT c.role,
       c.accepted_at IS NOT NULL AS angenommen,
       c.declined_at IS NULL     AS nicht_widerrufen,
       c.invited_by = t.owner_id AS vom_eigentuemer
  FROM public.tournament_collaborators c
  JOIN public.tournaments t ON t.id = c.tournament_id
 WHERE c.tournament_id = '<turnier-id>'
   AND c.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<mail>'));

-- 2b: Rechte so, wie der Server sie fuer diese Person auswertet. EIN einziger Befehl (kein BEGIN/ROLLBACK noetig,
-- der Editor zeigt nur das Ergebnis der letzten Abfrage). Die Person gilt nur fuer diesen einen Befehl.
-- Kontrollspalte geprueft_person muss die Kennung aus 0b zeigen; ist die Tabelle leer, gibt es das Konto nicht.
-- Erwartet (ab A-11 live): die ersten zehn hat_es = true, deleteTournament und manageMembers = false.
-- Erwartet VOR A-11 (Fenster 10.11.): manageSchedule, manageLifecycle, manageScreens, manageHelpers = false.
WITH person AS MATERIALIZED (
  SELECT set_config('request.jwt.claim.sub', u.id::text, true) AS geprueft_person
    FROM auth.users u
   WHERE lower(u.email) = lower('<mail>')
)
SELECT pe.geprueft_person, p AS recht,
       CASE WHEN pe.geprueft_person IS NOT NULL
            THEN public.has_tournament_permission('<turnier-id>', p) END AS hat_es
  FROM person pe,
       unnest(ARRAY['writeMatchData','correctEvents','leadMatches','tournamentSettings','teams','restructure',
                    'manageSchedule','manageLifecycle','manageScreens','manageHelpers',
                    'deleteTournament','manageMembers']) AS p;

-- 2c (keine Abfrage): In der App als diese Person anmelden. Die Startseite zeigt das Turnier, sie kann es oeffnen.
-- Das ist die massgebliche Pruefung.


-- ##### BLOCK 3 - Austragen (Rueckweg)
-- Erwartet: genau 1 Zeile im RETURNING. Danach Block 2a: 0 Zeilen. Das Konto selbst bleibt (loeschen nur bewusst:
-- Authentication > Users > Delete user; die Mitgliedschaft verschwindet dann ohnehin mit).
DELETE FROM public.tournament_collaborators c
 WHERE c.tournament_id = '<turnier-id>'
   AND c.role = 'co-admin'
   AND c.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<mail>'))
RETURNING c.id, c.role;

-- ##### ENDE
