-- db_privilege_assertions.sql — feste Liste von Spalten-/Funktionsrechten (R6).
--
-- Warum das hier und nicht im Textdiff/Katalogvergleich von db-drift-check.sh: Beide Beine dort
-- laufen gegen Dumps mit `--no-privileges` (siehe Kopfkommentar des Skripts und
-- supabase/migrations/README.md) — GRANT/REVOKE-Anweisungen sind für sie unsichtbar. Ein Live-
-- GRANT SELECT ON profiles TO anon (die genaue Lücke, die 20260924_001_restrict_profiles.sql
-- schließt) würde vom Textdiff NIE bemerkt. Diese Datei prüft deshalb LIVE, über die
-- eingebauten has_column_privilege()/has_function_privilege()-Funktionen, die für jede Rolle
-- ausführbar sind (kein Superuser/Owner nötig — im Wegwerf-Container mit einer eigens
-- angelegten, rechtelosen Rolle gegengeprüft, siehe Report).
--
-- Ausführung: von scripts/db-drift-check.sh per `psql --dbname="$SUPABASE_DB_READONLY_URL" -f`
-- unter der nur-lesenden Rolle ci_schema_reader. Gibt eine Zeile pro Prüfung aus:
-- "<name>|t" (grün) oder "<name>|f" (rot). Das aufrufende Skript wertet jedes "|f" als Fehler.
--
-- Positivkontrollen (die letzten beiden Zeilen) sind Pflicht, sonst wäre die Assertion
-- vakuum-grün: sie müssen "t" liefern, sonst hat schon die Messmethode selbst ein Problem
-- (z.B. falscher Rollen- oder Funktionsname), nicht erst der geprüfte Zustand.

\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

SELECT 'anon-no-select-profiles-email' AS name,
       NOT has_column_privilege('anon', 'public.profiles', 'email', 'SELECT') AS ok
UNION ALL
SELECT 'authenticated-no-select-profiles-email',
       NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')
UNION ALL
SELECT 'anon-no-select-profiles-auth-provider',
       NOT has_column_privilege('anon', 'public.profiles', 'auth_provider', 'SELECT')
UNION ALL
SELECT 'authenticated-no-select-profiles-auth-provider',
       NOT has_column_privilege('authenticated', 'public.profiles', 'auth_provider', 'SELECT')
UNION ALL
SELECT 'anon-no-select-profiles-preferences',
       NOT has_column_privilege('anon', 'public.profiles', 'preferences', 'SELECT')
UNION ALL
SELECT 'authenticated-no-select-profiles-preferences',
       NOT has_column_privilege('authenticated', 'public.profiles', 'preferences', 'SELECT')
UNION ALL
SELECT 'authenticated-no-update-profiles-role',
       NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
UNION ALL
SELECT 'anon-no-execute-merge-user-data',
       NOT has_function_privilege('anon', 'public.merge_user_data(uuid,uuid)', 'EXECUTE')
UNION ALL
SELECT 'authenticated-no-execute-merge-user-data',
       NOT has_function_privilege('authenticated', 'public.merge_user_data(uuid,uuid)', 'EXECUTE')
UNION ALL
-- Positivkontrollen (siehe Kopfkommentar) — müssen "t" sein.
SELECT 'positive-authenticated-select-display-name',
       has_column_privilege('authenticated', 'public.profiles', 'display_name', 'SELECT')
UNION ALL
SELECT 'positive-anon-execute-auth-provider-for-email',
       has_function_privilege('anon', 'public.auth_provider_for_email(text)', 'EXECUTE')
;
