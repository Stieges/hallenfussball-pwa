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
--   <turnier-id>  die Kennung des Turniers (Block 0 zeigt sie, oder aus der Adresse in der App)
--   <mail>        die E-Mail-Adresse des Kontos der Co-Admin (genau wie im Dashboard angelegt)
-- Beides jeweils in ALLEN Bloecken ersetzen (Suchen und Ersetzen im Editor: Strg+H bzw. Cmd+Option+F).
--
-- ARBEITSWEISE IM EDITOR: Der Editor zeigt nur das Ergebnis der LETZTEN Anweisung eines Laufs. Darum endet
-- jeder Block mit genau einer Ergebnis-Abfrage: immer nur EINEN Block markieren und ausfuehren
-- (Block 0, dann 1, dann 2a, 2b ...). Block 1 enthaelt zwei Anweisungen (Eintragen, danach Ergebnis-Abfrage)
-- und wird als Ganzes markiert.
--
-- WICHTIG: Es gibt absichtlich KEIN UPDATE der Rolle. Bis A-16 lehnte der Schutz-Trigger protect_collaborator_row
-- im Editor jedes UPDATE ab; seit A-16 (20261110_008, Definer-Durchgang) laesst er Aenderungen ausserhalb der App-Rollen
-- durch -- ein UPDATE im Editor ginge also, aendert aber ungeprueft. Die Vorlage bleibt deshalb beim Loeschen und
-- Neu-Anlegen und wirkt vor und nach A-16 gleich.
-- Eine AKTIVE co-admin-Zeile bleibt bei jeder Wiederholung unveraendert (Block 1 meldet nur "schon eingetragen").
-- Nur eine widerrufene/unangenommene co-admin-Zeile wird ersetzt: loeschen und neu anlegen.
-- Die Vorlage legt KEIN Konto an und loescht KEIN Konto. Sie traegt nur die eine genannte Person ein.
-- ====================================================================================================


-- ##### BLOCK 0 - Vorher pruefen (nur lesen; EINE Abfrage, liefert immer genau eine Zeile)
-- Erwartet: turnier_id und titel gefuellt (Titel vorlesen: Original oder Kopie?), deleted_at leer; user_id gefuellt,
-- email_confirmed_at gefuellt, anonym = false; bestehende_rolle leer (oder co-admin, dann wird nichts doppelt angelegt).
-- Leere Felder im Turnier-Teil: Kennung falsch. Leere Felder im Konto-Teil: Mail falsch oder Konto fehlt.
-- Mehr als eine Zeile: die Mail gehoert mehreren Konten -- nicht eintragen, erst klaeren.
SELECT t.id AS turnier_id, t.title AS titel, t.deleted_at,
       u.id AS user_id, u.email_confirmed_at,
       coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false) AS anonym,
       c.role AS bestehende_rolle, c.accepted_at, c.declined_at
  FROM (SELECT 1) AS x
  LEFT JOIN public.tournaments t ON t.id = '<turnier-id>'
  LEFT JOIN auth.users u ON lower(u.email) = lower('<mail>')
  LEFT JOIN public.tournament_collaborators c ON c.tournament_id = t.id AND c.user_id = u.id;


-- ##### BLOCK 1 - Eintragen (als Ganzes markieren; bricht bei jedem Zweifel ab, aendert dann nichts)
-- Ergebnis: die Zeile der Person im Turnier. Eine schon aktive co-admin-Zeile bleibt unveraendert.
DO $$
DECLARE
  v_turnier    uuid := '<turnier-id>';
  v_mail       text := lower('<mail>');
  v_owner      uuid;
  v_user       uuid;
  v_bestaetigt timestamptz;
  v_anonym     boolean;
  v_name       text;
BEGIN
  SELECT t.owner_id INTO v_owner
    FROM public.tournaments t
   WHERE t.id = v_turnier AND t.deleted_at IS NULL;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Abbruch: Turnier % gibt es nicht oder es ist gelöscht.', v_turnier;
  END IF;

  BEGIN
    SELECT u.id, u.email_confirmed_at, coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false),
           coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1))
      INTO STRICT v_user, v_bestaetigt, v_anonym, v_name
      FROM auth.users u
     WHERE lower(u.email) = v_mail;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE EXCEPTION 'Abbruch: Kein Konto mit dieser Mail. Erst im Dashboard anlegen (Authentication > Users > Add user, Auto Confirm User an).';
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Abbruch: Diese Mail gehört mehreren Konten. Erst klären, nicht eintragen.';
  END;
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
    RAISE EXCEPTION 'Abbruch: Es gibt schon einen Eintrag mit anderer Rolle. Block 0 ansehen und entscheiden, nicht überschreiben.';
  END IF;

  -- Schon aktiv eingetragen: nichts anfassen (keine neue id, kein neues Datum, Label bleibt).
  IF EXISTS (SELECT 1 FROM public.tournament_collaborators c
              WHERE c.tournament_id = v_turnier AND c.user_id = v_user AND c.role = 'co-admin'
                AND c.accepted_at IS NOT NULL AND c.declined_at IS NULL) THEN
    RAISE NOTICE 'Schon eingetragen: % ist co-admin in %. Nichts geändert.', v_user, v_turnier;
    RETURN;
  END IF;

  -- Kein UPDATE (bis A-16 lehnte protect_collaborator_row es im Editor ab; seit A-16 ginge es, die Vorlage bleibt gleich).
  -- Ersetzen = die eigene, widerrufene oder nie angenommene co-admin-Zeile löschen und neu anlegen.
  DELETE FROM public.tournament_collaborators c
   WHERE c.tournament_id = v_turnier AND c.user_id = v_user AND c.role = 'co-admin';

  INSERT INTO public.tournament_collaborators
    (tournament_id, user_id, role, invited_by, invited_at, accepted_at, label)
  VALUES
    (v_turnier, v_user, 'co-admin', v_owner, now(), now(), v_name);

  RAISE NOTICE 'Eingetragen: % als co-admin in %', v_user, v_turnier;
END
$$;

SELECT c.id AS eintrag, c.role, c.label, c.accepted_at, c.declined_at
  FROM public.tournament_collaborators c
 WHERE c.tournament_id = '<turnier-id>'
   AND c.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<mail>'));


-- ##### BLOCK 2a - Nachher pruefen: Eintrag
-- Erwartet genau 1 Zeile: co-admin | angenommen = true | nicht_widerrufen = true | vom_eigentuemer = true
SELECT c.role,
       c.accepted_at IS NOT NULL AS angenommen,
       c.declined_at IS NULL     AS nicht_widerrufen,
       c.invited_by = t.owner_id AS vom_eigentuemer
  FROM public.tournament_collaborators c
  JOIN public.tournaments t ON t.id = c.tournament_id
 WHERE c.tournament_id = '<turnier-id>'
   AND c.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<mail>'));


-- ##### BLOCK 2b - Nachher pruefen: Rechte
-- Rechte so, wie der Server sie fuer diese Person auswertet. EIN einziger Befehl (kein BEGIN/ROLLBACK noetig).
-- Die Person gilt nur fuer diesen einen Befehl.
-- Kontrollspalte geprueft_person muss die Kennung (user_id) aus Block 0 zeigen; ist die Tabelle leer, gibt es das Konto nicht.
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
-- Erwartet: genau 1 Zeile im Ergebnis (RETURNING). Danach Block 2a: 0 Zeilen. Das Konto selbst bleibt.
-- Konto loeschen ist KEIN Rueckweg: "Delete user" scheitert, sobald die Person etwas geaendert hat
-- (matches/tournaments.last_modified_by, match_corrections.corrected_by verweisen auf das Konto).
DELETE FROM public.tournament_collaborators c
 WHERE c.tournament_id = '<turnier-id>'
   AND c.role = 'co-admin'
   AND c.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<mail>'))
RETURNING c.id, c.role;

-- ##### ENDE
