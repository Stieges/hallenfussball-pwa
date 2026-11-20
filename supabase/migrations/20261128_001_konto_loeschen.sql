-- supabase/migrations/20261128_001_konto_loeschen.sql
-- Konto loeschen auf Anfrage (Record docs/anforderungen/2026-10-03_recht-impressum-datenschutz.md, @RE-009, @RE-010, @RE-011; Datenschutzerklaerung Abschnitt 5 und 11: "Konto: bis zur Loeschung auf Anfrage";
-- Record docs/anforderungen/2026-10-02_anmelden.md "Geparkt - Konto loeschen", Szenarien @FU-066, @HE-072, @EK-023).
--
-- Befund (Ist, geprueft im Wegwerf-Container mit Baseline + allen Migrationen):
--   - VIER Fremdschluessel auf auth.users ohne ON DELETE-Regel (= NO ACTION) BLOCKIEREN das Loeschen eines Kontos, sobald es je ein Spiel/
--     Turnier angefasst, eine Korrektur geschrieben oder jemanden eingeladen hat:
--       matches.last_modified_by, tournaments.last_modified_by, match_corrections.corrected_by, tournament_collaborators.invited_by.
--     (Jede Engine-Funktion setzt matches.last_modified_by = auth.uid(); auch anonyme Helfer-Konten tragen sich dort ein.)
--   - UMGEKEHRT der gefaehrliche Fall: tournaments.owner_id ist ON DELETE CASCADE. Wer das Konto eines Eigentuemers loescht, loescht
--     sein Turnier samt Spielen, Ereignissen, Mannschaften, Monitoren (Kaskade; die Schutz-Trigger greifen dabei absichtlich nicht,
--     siehe 20260925_002 und 20261004_101: "Kaskade aus auth.users bleibt frei"). Das ist heute nur deshalb noch nicht passiert, weil die
--     vier Fremdschluessel oben das Loeschen eines Eigentuemers meist vorher abbrechen. Wuerde man NUR die vier reparieren, waere der
--     Weg frei, mit einem Klick versehentlich alle Turniere eines Kontos zu loeschen.
--
-- Inhalt (Loesung A):
--   1. Drei der vier blockierenden Fremdschluessel werden ON DELETE SET NULL: matches.last_modified_by, tournaments.last_modified_by,
--      match_corrections.corrected_by. Das Konto geht, die Zeile (Spiel, Turnier, Korrektur) bleibt, nur der Verweis auf die geloeschte
--      Person faellt weg. Das Ereignisprotokoll bleibt lesbar (match_event_authors.user_id ist schon heute SET NULL; die Namensfunktion
--      liefert dann Name NULL = "geloeschtes Konto").
--   2. Der vierte, tournament_collaborators.invited_by, wird ENTFERNT (Spalte bleibt, nur der Fremdschluessel faellt weg), nicht auf SET NULL
--      gestellt: SET NULL wuerde ein UPDATE auf tournament_collaborators ausloesen, und den lehnt der Schutz-Trigger protect_collaborator_row
--      ab (nur Eigentuemer darf Mitarbeiter-Zeilen aendern; im Container belegt: "Nicht erlaubt: nur der Turnier-Eigentuemer ..."). Diese
--      sicherheitsrelevante Funktion wird hier bewusst NICHT angefasst (md5-gepinnt in scripts/helper-join-check.sh). Folge: die UUID des
--      eingeladenen-von-Kontos bleibt als nicht mehr zuordenbare Kennung in der Zeile stehen (kein Name, keine E-Mail; die Zeile
--      des Eingeladenen bleibt unberuehrt). Wer sie trotzdem leeren will: siehe ANALYSE.md, Betreiber-Ablauf.
--   3. tournaments.owner_id: ON DELETE CASCADE -> ON DELETE RESTRICT. Ein Konto, dem noch ein Turnier gehoert (auch eines im Papierkorb),
--      kann NICHT geloescht werden; die Datenbank meldet 23001 "... violates foreign key constraint tournaments_owner_id_fkey".
--      Erst muss das Turnier bewusst geloescht (Frist der Datenschutzerklaerung: spaetestens 6 Monate nach dem Turnier) werden.
--   4. Hilfsfunktion public.account_deletion_check(p_user_id uuid) -> jsonb, NUR service_role, nur lesend: sagt dem Betreiber vor dem
--      Loeschen, ob das Konto blockiert ist (Turniere des Kontos ODER Spuren in einem abgeschlossenen Turnier) und was daran haengt
--      (Turniere, Mitgliedschaften, Veranstaltungen samt Bildschirmen, Verweise, die auf NULL gehen oder als Kennung stehen bleiben).
--      Ohne Titel, Namen und E-Mail: Turniere nur mit Kennung und Datum.
--   EINSCHRAENKUNG (Entscheidung des Product Owners 18.11.2026, Weg b): Die Abschluss-Sperre (guard_closed_tournament, tournaments_guard_lifecycle)
--   wird NICHT angefasst. Die Verweis-Aenderung beim Loeschen ist fuer sie ein gewoehnliches UPDATE und wird in einem ABGESCHLOSSENEN
--   (lifecycle_status finished/cancelled) Turnier abgelehnt (55000 TOURNAMENT_FINISHED; die ganze Loeschung rollt zurueck, nichts geht verloren).
--   Betroffen sind genau die Verweise in gesperrten Tabellen: matches.last_modified_by, match_corrections.corrected_by,
--   tournaments.last_modified_by und (schon vor dieser Migration) field_control.holder_user_id. Folge: ein Konto mit Spuren in einem
--   abgeschlossenen Turnier ist erst loeschbar, nachdem der Betreiber das Turnier wieder geoeffnet hat. account_deletion_check meldet das
--   VORHER als blocked = true (Feld closed_tournament_refs: Turnier-Kennung und Datum, kein Titel). Spaeter (nach dem Nikolausturnier) kann die
--   Sperre die Verweis-Aenderung durchlassen (Weg a, geparkt).
--   Unveraendert (kaskadieren weiter mit dem Konto, gewollt): profiles, sync_queue, tournament_collaborators.user_id (Mitgliedschaft),
--   tournament_templates, gatherings (+ gathering_members), tournament_join_requests.device_user_id, revoked_device_contacts.
--   Schon heute SET NULL (unveraendert): match_event_authors, match_reviews, field_control(_log), tournament_join_codes, ...decided_by.
--
-- Rueckwaertsvertraeglichkeit:
--   - NICHT "rein ergaenzend" im Wortsinn: VIER bestehende Fremdschluessel-Regeln werden GEAENDERT (matches.last_modified_by,
--     tournaments.last_modified_by, match_corrections.corrected_by: NO ACTION -> SET NULL; tournaments.owner_id: CASCADE -> RESTRICT),
--     EIN Fremdschluessel ENTFAELLT (tournament_collaborators.invited_by; die Datenbank prueft die Kennung dort beim Schreiben nicht mehr,
--     die Server-Funktionen setzen auth.uid()), dazu EINE neue, nur lesende Funktion. Keine Policy, kein Trigger und keine bestehende
--     Funktion wird geaendert. Keine Zeile wird geloescht oder umgeschrieben, keine Spalte entfernt. Die Regeln greifen nur beim Loeschen
--     eines Kontos.
--   - Der Client kennt die Regeln nicht (kein Embed ueber diese Fremdschluessel; invited_by wird nur gelesen, membershipService.ts:53) ->
--     kein Client-Update noetig.
--   - Wer heute ein Turnier ODER Spiel schreibt, merkt nichts: die Regeln greifen nur beim Loeschen eines Kontos.
--   - Verhaltensaenderung fuer Wartungsskripte: ein Konto mit Turnieren laesst sich nicht mehr "nebenbei" per auth.admin.deleteUser
--     loeschen (scripts/e2e-seed.ts loescht Test-Turniere vorher; supabase/functions/merge-accounts meldet den Fehler nur als Warnung).
--   - SET NULL aktualisiert beim Loeschen eines Kontos die betroffenen Zeilen. Belegt im Container: die Versionszaehler (version) bleiben
--     dabei gleich, kein Geraet sieht einen Versionskonflikt.
--
-- Sperren: lock_timeout 5 s. DROP/ADD CONSTRAINT nimmt kurz ACCESS EXCLUSIVE auf matches, tournaments, match_corrections und
--   tournament_collaborators (nur DROP); das Setzen des neuen Fremdschluessels (ADD ... FOREIGN KEY) nimmt SHARE ROW EXCLUSIVE auf der Kindtabelle UND
--   auf auth.users (Schreiber auf auth.users, z. B. Anmeldungen, warten die paar Millisekunden). Prueft die Zeilen gleich mit (kein
--   NOT VALID/VALIDATE: die Tabellen sind klein - live matches im Dutzend-Bereich, tournaments einstellig - und in EINER Transaktion
--   blieben die Sperren ohnehin bis zum Ende). Laufende Schreiber (Cockpit, append_match_events) warten dann kurz, sie scheitern nicht.
--   Bei 55P03 (Sperre nicht erhalten, z. B. mitten in einem Spiel) genau einmal wiederholen, am besten zwischen zwei Spielen.
-- Voraussetzungen (Fail-fast, ohne Aenderung): die fuenf Fremdschluessel existieren (invited_by darf fehlen = schon umgesetzt), zeigen auf auth.users(id) der erwarteten Spalte und
--   haben entweder die Regel von heute oder schon die neue (dann wird nichts angefasst); auth.users, tournament_has_started, tournament_is_closed und field_control existieren.
-- Idempotent: zweimal einspielbar (jeder Schritt prueft die heutige Regel, CREATE OR REPLACE, REVOKE/GRANT).
--
-- RUECKWEG: supabase/rollbacks/20261128_001_konto_loeschen_rollback.sql (stellt die Regeln wie vor dieser Migration wieder her, invited_by als NOT VALID, weil
--   inzwischen Kennungen geloeschter Konten darin stehen koennen; entfernt die Funktion; schon auf NULL gesetzte Verweise bleiben NULL). ACHTUNG: nach dem Rueckweg kaskadiert tournaments.owner_id wieder.
-- Bestand: die Migration loescht und aendert KEINE Zeile (nur Regeln an Fremdschluesseln, eine neue Funktion); die sechs echten
--   veroeffentlichten Turniere der Produktion bleiben unveraendert, ihr Eigentuemer-Konto ist danach nicht mehr loeschbar, solange sie existieren.
-- Produktion: nur nach Freigabe des Betreibers (SQL + md5). Dieser Branch spielt nichts ein. Pruefskript: scripts/konto-loeschen-check.sh.
-- Rein ASCII.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $pre$
DECLARE
  r record;
  v_del "char";
  v_ok boolean;
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('public.tournament_has_started(uuid)') IS NULL
     OR to_regprocedure('public.tournament_is_closed(uuid)') IS NULL OR to_regclass('public.field_control') IS NULL
     OR to_regclass('public.gathering_screens') IS NULL OR to_regclass('public.gathering_members') IS NULL THEN
    RAISE EXCEPTION '20261128_001_konto_loeschen: auth.users, tournament_has_started, tournament_is_closed, field_control, gathering_screens oder gathering_members fehlt -- abgebrochen';
  END IF;
  FOR r IN
    SELECT * FROM (VALUES
      ('public.matches',                    'last_modified_by', 'matches_last_modified_by_fkey',                    'a', 'n'),
      ('public.tournaments',               'last_modified_by', 'tournaments_last_modified_by_fkey',               'a', 'n'),
      ('public.match_corrections',          'corrected_by',     'match_corrections_corrected_by_fkey',             'a', 'n'),
      ('public.tournament_collaborators',   'invited_by',       'tournament_collaborators_invited_by_fkey',        'a', 'n'),
      ('public.tournaments',               'owner_id',         'tournaments_owner_id_fkey',                       'c', 'r')
    ) AS t(tbl, col, conname, old_rule, new_rule)
  LOOP
    IF r.col = 'invited_by' AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = r.tbl::regclass AND c.conname = r.conname) THEN
      CONTINUE;   -- schon entfernt (Idempotenz)
    END IF;
    SELECT c.confdeltype,
           (c.confrelid = 'auth.users'::regclass AND c.contype = 'f' AND array_length(c.conkey, 1) = 1
            AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND a.attname = r.col))
      INTO v_del, v_ok
      FROM pg_constraint c
     WHERE c.conrelid = r.tbl::regclass AND c.conname = r.conname;
    IF v_ok IS NOT TRUE THEN
      RAISE EXCEPTION '20261128_001_konto_loeschen: Fremdschluessel % auf % fehlt oder zeigt nicht auf auth.users(%) -- abgebrochen', r.conname, r.tbl, r.col;
    END IF;
    IF v_del::text NOT IN (r.old_rule, r.new_rule) THEN
      RAISE EXCEPTION '20261128_001_konto_loeschen: Fremdschluessel % hat eine unerwartete ON DELETE-Regel (%) -- abgebrochen', r.conname, v_del;
    END IF;
  END LOOP;
END
$pre$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Drei blockierende Verweise: ON DELETE SET NULL (nur wenn heute NO ACTION); invited_by: Fremdschluessel entfernen
-- ---------------------------------------------------------------------------------------------------------------
DO $fk$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.matches',                  'last_modified_by', 'matches_last_modified_by_fkey'),
      ('public.tournaments',              'last_modified_by', 'tournaments_last_modified_by_fkey'),
      ('public.match_corrections',        'corrected_by',     'match_corrections_corrected_by_fkey')
    ) AS t(tbl, col, conname)
  LOOP
    IF (SELECT c.confdeltype FROM pg_constraint c WHERE c.conrelid = r.tbl::regclass AND c.conname = r.conname) = 'a' THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.tbl, r.conname, r.col);
      EXECUTE format('COMMENT ON CONSTRAINT %I ON %s IS %L', r.conname, r.tbl,
        'Konto geloescht -> Verweis wird NULL, Zeile bleibt (Konto loeschen, 20261128_001).');
    END IF;
  END LOOP;
END
$fk$;

DO $inv$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.tournament_collaborators'::regclass
                AND c.conname = 'tournament_collaborators_invited_by_fkey' AND c.confdeltype = 'a') THEN
    ALTER TABLE public.tournament_collaborators DROP CONSTRAINT tournament_collaborators_invited_by_fkey;
  END IF;
  COMMENT ON COLUMN public.tournament_collaborators.invited_by IS
    'Konto, das eingeladen hat. Ohne Fremdschluessel (Konto loeschen, 20261128_001): nach dem Loeschen des Kontos bleibt die Kennung als nicht mehr zuordenbare UUID stehen.';
END
$inv$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Schutz der Turniere: tournaments.owner_id ON DELETE RESTRICT statt CASCADE
-- ---------------------------------------------------------------------------------------------------------------
DO $own$
BEGIN
  IF (SELECT c.confdeltype FROM pg_constraint c
       WHERE c.conrelid = 'public.tournaments'::regclass AND c.conname = 'tournaments_owner_id_fkey') = 'c' THEN
    ALTER TABLE public.tournaments DROP CONSTRAINT tournaments_owner_id_fkey;
    ALTER TABLE public.tournaments
      ADD CONSTRAINT tournaments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
    COMMENT ON CONSTRAINT tournaments_owner_id_fkey ON public.tournaments IS
      'Konto mit Turnier laesst sich nicht loeschen (RESTRICT, 23001): erst das Turnier bewusst loeschen (Konto loeschen, 20261128_001).';
  END IF;
END
$own$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Vorpruefung fuer den Betreiber (nur lesend, nur service_role)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_deletion_check(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tournaments jsonb;
  v_n_owned     integer;
  v_closed      jsonb;
  v_n_closed    integer;
BEGIN
  -- Turniere des Kontos (RESTRICT). Nur Kennung und Datum, kein Titel: der Titel kann ein Personenname sein (@RE-011 "ohne Namen").
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'date', t.date::text, 'in_trash', t.deleted_at IS NOT NULL,
                                                'started', public.tournament_has_started(t.id)) ORDER BY t.created_at), '[]'::jsonb),
         count(*)
    INTO v_tournaments, v_n_owned
    FROM public.tournaments t
   WHERE t.owner_id = p_user_id;
  -- Abgeschlossene Turniere (finished/cancelled), in denen das Konto eine Spur hat, die beim Loeschen auf NULL gesetzt wuerde: die
  -- Abschluss-Sperre lehnt dieses UPDATE ab (TOURNAMENT_FINISHED), die Loeschung scheiterte. Der Betreiber oeffnet genau diese Turniere
  -- vorher wieder. Gleiche Tabellen/Spalten wie die Sperre (guard_closed_tournament, tournaments_guard_lifecycle).
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.created_at), '[]'::jsonb), count(*)
    INTO v_closed, v_n_closed
    FROM (SELECT t.created_at,
                 jsonb_build_object('id', t.id, 'date', t.date::text, 'lifecycle_status', t.lifecycle_status,
                   'matches_last_modified_by',       (SELECT count(*) FROM public.matches m WHERE m.tournament_id = t.id AND m.last_modified_by = p_user_id),
                   'match_corrections_corrected_by', (SELECT count(*) FROM public.match_corrections c JOIN public.matches m ON m.id = c.match_id
                                                       WHERE m.tournament_id = t.id AND c.corrected_by = p_user_id),
                   'tournament_last_modified_by',    (t.last_modified_by = p_user_id),
                   'field_control_holder',           (SELECT count(*) FROM public.field_control f WHERE f.tournament_id = t.id AND f.holder_user_id = p_user_id)) AS j
            FROM public.tournaments t
           WHERE public.tournament_is_closed(t.id)
             AND (t.last_modified_by = p_user_id
                  OR EXISTS (SELECT 1 FROM public.matches m WHERE m.tournament_id = t.id AND m.last_modified_by = p_user_id)
                  OR EXISTS (SELECT 1 FROM public.match_corrections c JOIN public.matches m ON m.id = c.match_id
                              WHERE m.tournament_id = t.id AND c.corrected_by = p_user_id)
                  OR EXISTS (SELECT 1 FROM public.field_control f WHERE f.tournament_id = t.id AND f.holder_user_id = p_user_id))) x;
  RETURN jsonb_build_object(
    'user_exists',            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id),
    'blocked',                v_n_owned > 0 OR v_n_closed > 0,
    'blocked_by', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb)
                     FROM unnest(ARRAY[CASE WHEN v_n_owned > 0 THEN 'owns_tournaments' END,
                                       CASE WHEN v_n_closed > 0 THEN 'refs_in_closed_tournaments' END]) AS r WHERE r IS NOT NULL),
    'owned_tournaments',      v_tournaments,
    'closed_tournament_refs', v_closed,
    'memberships',            (SELECT count(*) FROM public.tournament_collaborators c WHERE c.user_id = p_user_id),
    'owned_gatherings',       (SELECT count(*) FROM public.gatherings g WHERE g.owner_id = p_user_id),
    'gathering_removal', jsonb_build_object(
      'screens',              (SELECT count(*) FROM public.gathering_screens s JOIN public.gatherings g ON g.id = s.gathering_id WHERE g.owner_id = p_user_id),
      'members_of_others',    (SELECT count(*) FROM public.gathering_members gm JOIN public.gatherings g ON g.id = gm.gathering_id
                                WHERE g.owner_id = p_user_id AND gm.user_id IS DISTINCT FROM p_user_id),
      'tournaments_assigned', (SELECT count(*) FROM public.tournaments t JOIN public.gatherings g ON g.id = t.gathering_id WHERE g.owner_id = p_user_id)),
    'templates',              (SELECT count(*) FROM public.tournament_templates x WHERE x.owner_id = p_user_id),
    'refs_set_null', jsonb_build_object(
      'matches_last_modified_by',      (SELECT count(*) FROM public.matches m WHERE m.last_modified_by = p_user_id),
      'tournaments_last_modified_by',  (SELECT count(*) FROM public.tournaments t WHERE t.last_modified_by = p_user_id),
      'match_corrections_corrected_by',(SELECT count(*) FROM public.match_corrections x WHERE x.corrected_by = p_user_id),
      'match_event_authors_user_id',   (SELECT count(*) FROM public.match_event_authors a WHERE a.user_id = p_user_id),
      'field_control_holder_user_id',  (SELECT count(*) FROM public.field_control f WHERE f.holder_user_id = p_user_id),
      'field_control_log_holder_user_id', (SELECT count(*) FROM public.field_control_log f WHERE f.holder_user_id = p_user_id),
      'match_reviews_user_id',         (SELECT count(*) FROM public.match_reviews r WHERE r.user_id = p_user_id),
      'join_codes_created_or_revoked_by', (SELECT count(*) FROM public.tournament_join_codes j WHERE j.created_by = p_user_id OR j.revoked_by = p_user_id),
      'join_requests_decided_by',      (SELECT count(*) FROM public.tournament_join_requests j WHERE j.decided_by = p_user_id)),
    'refs_without_fk', jsonb_build_object(
      'collaborators_invited_by',      (SELECT count(*) FROM public.tournament_collaborators c WHERE c.invited_by = p_user_id),
      'device_outbox_reports_user_id', (SELECT count(*) FROM public.device_outbox_reports d WHERE d.user_id = p_user_id),
      'tournament_lifecycle_log_actor',(SELECT count(*) FROM public.tournament_lifecycle_log l WHERE l.actor = p_user_id),
      'group_completions_completed_by',(SELECT count(*) FROM public.group_completions g WHERE g.completed_by = p_user_id)));
END;
$$;

COMMENT ON FUNCTION public.account_deletion_check(uuid) IS
  'Vorpruefung vor dem Loeschen eines Kontos (nur service_role, nur lesend): blocked = true, solange dem Konto ein Turnier gehoert
   (auch im Papierkorb; blocked_by owns_tournaments) ODER es Spuren in einem abgeschlossenen Turnier hat (blocked_by refs_in_closed_tournaments;
   closed_tournament_refs nennt Kennung und Datum der Turniere, die der Betreiber vorher wieder oeffnen muss). refs_set_null: Verweise, die beim
   Loeschen auf NULL gehen. refs_without_fk: Kennungen ohne Fremdschluessel, die als nicht mehr zuordenbare UUID stehen bleiben.
   gathering_removal: was mit den Veranstaltungen des Kontos wegfaellt (Bildschirme, Mitglieder anderer, zugeordnete Turniere) - nur Meldung,
   blockiert nicht. Liefert keinen Titel, keinen Namen und keine E-Mail (Konto loeschen, 20261128_001).';

REVOKE ALL ON FUNCTION public.account_deletion_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_check(uuid) TO service_role;

COMMIT;
