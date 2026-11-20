-- supabase/rollbacks/20261128_001_konto_loeschen_rollback.sql
-- Rueckweg zu supabase/migrations/20261128_001_konto_loeschen.sql:
--   - die Verweise matches.last_modified_by, tournaments.last_modified_by, match_corrections.corrected_by gehen zurueck auf "keine
--     ON DELETE-Regel" (NO ACTION, wie die Baseline); tournament_collaborators.invited_by bekommt seinen Fremdschluessel (NO ACTION)
--     zurueck, aber als NOT VALID: Zeilen, in denen inzwischen die Kennung eines geloeschten Kontos steht, wuerden sonst die Pruefung
--     scheitern lassen (neue und geaenderte Zeilen werden geprueft, Altzeilen nicht);
--   - tournaments.owner_id geht zurueck auf ON DELETE CASCADE (ACHTUNG: dann loescht das Loeschen eines Eigentuemer-Kontos wieder seine
--     Turniere samt Spielen);
--   - public.account_deletion_check(uuid) wird entfernt.
-- Was bleibt: Verweise, die zwischenzeitlich beim Loeschen eines Kontos auf NULL gesetzt wurden, bleiben NULL (Daten werden nicht erfunden).
-- Sperren und Fail-fast wie die Migration (lock_timeout 5 s, eine Transaktion). Idempotent: jeder Schritt prueft die heutige Regel.
-- Rein ASCII.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $fk$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.matches',                  'last_modified_by', 'matches_last_modified_by_fkey',                '',                'n'),
      ('public.tournaments',              'last_modified_by', 'tournaments_last_modified_by_fkey',            '',                'n'),
      ('public.match_corrections',        'corrected_by',     'match_corrections_corrected_by_fkey',          '',                'n'),
      ('public.tournaments',              'owner_id',         'tournaments_owner_id_fkey',                    ' ON DELETE CASCADE', 'r')
    ) AS t(tbl, col, conname, rule_sql, from_rule)
  LOOP
    IF to_regclass(r.tbl) IS NULL OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = r.tbl::regclass AND c.conname = r.conname AND c.contype = 'f') THEN
      RAISE EXCEPTION '20261128_001_konto_loeschen_rollback: Fremdschluessel % auf % fehlt -- abgebrochen', r.conname, r.tbl;
    END IF;
    IF (SELECT c.confdeltype FROM pg_constraint c WHERE c.conrelid = r.tbl::regclass AND c.conname = r.conname)::text = r.from_rule THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id)%s', r.tbl, r.conname, r.col, r.rule_sql);
    END IF;
  END LOOP;
END
$fk$;

DO $inv$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.tournament_collaborators'::regclass
                    AND c.conname = 'tournament_collaborators_invited_by_fkey') THEN
    ALTER TABLE public.tournament_collaborators
      ADD CONSTRAINT tournament_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  COMMENT ON COLUMN public.tournament_collaborators.invited_by IS NULL;   -- Spaltenkommentar der Migration entfernen (vorher keiner)
END
$inv$;

DROP FUNCTION IF EXISTS public.account_deletion_check(uuid);

COMMIT;
