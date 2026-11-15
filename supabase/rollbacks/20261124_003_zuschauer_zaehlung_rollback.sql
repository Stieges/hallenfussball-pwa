-- supabase/rollbacks/20261124_003_zuschauer_zaehlung_rollback.sql
-- RUECKWEG zu supabase/migrations/20261124_003_zuschauer_zaehlung.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt); belegt in scripts/zuschauer-zaehlung-check.sh (Schema danach = Stand vorher). EIN Block.
-- Reihenfolge: ZUERST die App auf den Stand ohne Zaehl-Client, DANN dieser Block (der Client verschluckt den fehlenden Aufruf
-- ohnehin still). Die gezaehlten Zahlen gehen verloren (vorher sichern: COPY public.public_view_counts TO ...).
-- Rein ASCII.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.count_public_view(text, text, text, text, boolean);
DROP TABLE IF EXISTS public.public_view_counts;
COMMIT;
