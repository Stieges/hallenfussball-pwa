-- db_privilege_assertions.sql — feste Liste von Spalten-/Funktions-/Tabellenrechten (R6).
--
-- Warum das hier und nicht im Textdiff/Katalogvergleich von db-drift-check.sh: Beide Beine dort
-- laufen gegen Dumps mit `--no-privileges` (siehe Kopfkommentar des Skripts und
-- supabase/migrations/README.md) — GRANT/REVOKE-Anweisungen sind für sie unsichtbar. Ein Live-
-- GRANT SELECT ON profiles TO anon (die genaue Lücke, die 20260924_001_restrict_profiles.sql
-- schließt) würde vom Textdiff NIE bemerkt. Diese Datei prüft deshalb LIVE, über die
-- eingebauten has_column_privilege()/has_function_privilege()/has_table_privilege()-Funktionen,
-- die für jede Rolle ausführbar sind (kein Superuser/Owner nötig — im Wegwerf-Container mit
-- einer eigens angelegten, rechtelosen Rolle gegengeprüft, siehe Report).
--
-- Fixrunde 1 (task-R6-review.md, L1+L2+M1): Die ursprüngliche Liste hatte 11 Zeilen und prüfte
-- nur "endet keine Zeile auf |f" — eine geleerte oder auf Kommentare gekürzte Datei wäre dadurch
-- ebenfalls "grün" gewesen (L2, Befund 1). scripts/db-drift-check.sh erzwingt deshalb zusätzlich
-- eine FESTE NAMENSLISTE (PRIVILEGE_ASSERTION_NAMES) — jede fehlende oder unerwartete Zeile ist
-- ein Fehler, unabhängig vom "|f"-Check. Ergänzt wurden außerdem (L1) MAINTAIN (seit PG17 Teil
-- von "ALL", vom alten REVOKE mit Einzelliste übersehen — anon/authenticated konnten
-- LOCK TABLE/ANALYZE auf profiles ausführen) und (L2) INSERT/DELETE/TRUNCATE auf profiles sowie
-- UPDATE auf email/auth_provider (ein UPDATE-Recht dort wäre ein echter Angriff: Nutzer setzt
-- die eigene email auf die des Opfers und auth_provider='google', die RPC bestätigt das dann für
-- den Angreifer). Dazu (M1) anon-no-select-profiles-display-name, weil der anon-GRANT auf
-- profiles seit Fixrunde 1 komplett entfällt (siehe Migrations-Kopfkommentar, Abschnitt M1).
--
-- Ausführung: von scripts/db-drift-check.sh per `psql --dbname="$SUPABASE_DB_READONLY_URL" -f`
-- unter der nur-lesenden Rolle ci_schema_reader. Gibt eine Zeile pro Prüfung aus:
-- "<name>|t" (grün) oder "<name>|f" (rot). Das aufrufende Skript wertet jedes "|f" als Fehler
-- UND vergleicht die Namensliste gegen PRIVILEGE_ASSERTION_NAMES (siehe dort).
--
-- Positivkontrollen (die letzten Zeilen) sind Pflicht, sonst wäre die Assertion vakuum-grün: sie
-- müssen "t" liefern, sonst hat schon die Messmethode selbst ein Problem (z.B. falscher Rollen-
-- oder Funktionsname), nicht erst der geprüfte Zustand.
--
-- R5b (task-R5b-brief.md, Abschnitt 4): public.role_permissions -- anon bekommt GAR KEIN
-- Tabellenrecht (REVOKE ALL), authenticated NUR SELECT (kein INSERT/UPDATE/DELETE), und
-- ci_schema_reader bekommt SELECT dazu (siehe Migrationskommentar an der Tabelle für die
-- Begründung: diese eine Tabelle braucht echten Zeilenzugriff für die nur-lesende CI-Rolle,
-- anders als jede andere Tabelle -- has_table_privilege() prüft hier nur den GRANT, nicht die
-- RLS-Policy; der eigentliche Zeileninhalt wird separat live verglichen, siehe
-- scripts/db-drift-check.sh, Abschnitt "role_permissions-Inhalt vs. rolePermissions.json").

\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

-- Tabellenrechte (L1: REVOKE ALL statt Einzelliste — MAINTAIN nicht vergessen; L2: INSERT/
-- DELETE/TRUNCATE ergänzt). anon hat seit Fixrunde 1 (M1) GAR KEIN Tabellenrecht mehr auf
-- profiles, authenticated nur die unten einzeln geprüften Spalten-GRANTs.
SELECT 'anon-no-insert-profiles' AS name,
       NOT has_table_privilege('anon', 'public.profiles', 'INSERT') AS ok
UNION ALL
SELECT 'authenticated-no-insert-profiles',
       NOT has_table_privilege('authenticated', 'public.profiles', 'INSERT')
UNION ALL
SELECT 'anon-no-delete-profiles',
       NOT has_table_privilege('anon', 'public.profiles', 'DELETE')
UNION ALL
SELECT 'authenticated-no-delete-profiles',
       NOT has_table_privilege('authenticated', 'public.profiles', 'DELETE')
UNION ALL
SELECT 'anon-no-truncate-profiles',
       NOT has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
UNION ALL
SELECT 'authenticated-no-truncate-profiles',
       NOT has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
UNION ALL
SELECT 'anon-no-maintain-profiles',
       NOT has_table_privilege('anon', 'public.profiles', 'MAINTAIN')
UNION ALL
SELECT 'authenticated-no-maintain-profiles',
       NOT has_table_privilege('authenticated', 'public.profiles', 'MAINTAIN')
UNION ALL
-- Spalten-SELECT
SELECT 'anon-no-select-profiles-email',
       NOT has_column_privilege('anon', 'public.profiles', 'email', 'SELECT')
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
SELECT 'anon-no-select-profiles-display-name',
       NOT has_column_privilege('anon', 'public.profiles', 'display_name', 'SELECT')
UNION ALL
-- Spalten-UPDATE
SELECT 'authenticated-no-update-profiles-role',
       NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-update-profiles-email',
       NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-update-profiles-auth-provider',
       NOT has_column_privilege('authenticated', 'public.profiles', 'auth_provider', 'UPDATE')
UNION ALL
-- Funktionsrechte
SELECT 'anon-no-execute-merge-user-data',
       NOT has_function_privilege('anon', 'public.merge_user_data(uuid,uuid)', 'EXECUTE')
UNION ALL
SELECT 'authenticated-no-execute-merge-user-data',
       NOT has_function_privilege('authenticated', 'public.merge_user_data(uuid,uuid)', 'EXECUTE')
UNION ALL
-- R5b: role_permissions -- anon nichts, authenticated nur SELECT.
SELECT 'anon-no-select-role-permissions',
       NOT has_table_privilege('anon', 'public.role_permissions', 'SELECT')
UNION ALL
SELECT 'authenticated-no-insert-role-permissions',
       NOT has_table_privilege('authenticated', 'public.role_permissions', 'INSERT')
UNION ALL
SELECT 'authenticated-no-update-role-permissions',
       NOT has_table_privilege('authenticated', 'public.role_permissions', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-delete-role-permissions',
       NOT has_table_privilege('authenticated', 'public.role_permissions', 'DELETE')
UNION ALL
-- Positivkontrollen (siehe Kopfkommentar) — müssen "t" sein.
SELECT 'positive-authenticated-select-display-name',
       has_column_privilege('authenticated', 'public.profiles', 'display_name', 'SELECT')
UNION ALL
SELECT 'positive-anon-execute-auth-provider-for-email',
       has_function_privilege('anon', 'public.auth_provider_for_email(text)', 'EXECUTE')
UNION ALL
SELECT 'positive-authenticated-select-role-permissions',
       has_table_privilege('authenticated', 'public.role_permissions', 'SELECT')
UNION ALL
SELECT 'positive-ci-schema-reader-select-role-permissions',
       has_table_privilege('ci_schema_reader', 'public.role_permissions', 'SELECT')
UNION ALL
-- R7-Fixrunde 1 (N-4, final-review-2.md): Ohne diese beiden Zeilen bliebe ein Live-ACL-Drift
-- (ein versehentliches REVOKE EXECUTE) dem Drift-Check verborgen, obwohl der Container-Harness
-- ihn fängt (DB-Mutation M4 des Reviews: EXECUTE auf is_active_tournament_member für anon
-- entzogen → Public-Read-Stichprobe wird ROT) — die beiden Umgebungen prüfen unterschiedliche
-- Dinge (Wegwerf-Container vs. Live-ACL), beide müssen dieselbe Lücke fangen können. Die Folge
-- eines Live-Drifts wäre der stille Ausfall von Public View und Monitoren (anonymer Zugriff auf
-- ein öffentliches Turnier läuft über genau diese beiden Funktionen).
SELECT 'positive-anon-execute-is-active-tournament-member',
       has_function_privilege('anon', 'public.is_active_tournament_member(uuid)', 'EXECUTE')
UNION ALL
SELECT 'positive-anon-execute-has-tournament-permission',
       has_function_privilege('anon', 'public.has_tournament_permission(uuid,text)', 'EXECUTE')
;
