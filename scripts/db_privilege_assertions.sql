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
UNION ALL
-- B2 (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B2-brief.md, R16/R17): match_event_authors
-- ist NICHT oeffentlich -- anon bekommt GAR KEIN Tabellenrecht (REVOKE ALL), authenticated darf
-- nur SELECT (die Zeilen selbst filtert has_tournament_permission(..., 'writeMatchData') in der
-- Policy -- kein INSERT/UPDATE/DELETE, nur append_match_events (B3b) schreibt hier).
SELECT 'anon-no-select-match-event-authors',
       NOT has_table_privilege('anon', 'public.match_event_authors', 'SELECT')
UNION ALL
SELECT 'authenticated-no-insert-match-event-authors',
       NOT has_table_privilege('authenticated', 'public.match_event_authors', 'INSERT')
UNION ALL
SELECT 'authenticated-no-update-match-event-authors',
       NOT has_table_privilege('authenticated', 'public.match_event_authors', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-delete-match-event-authors',
       NOT has_table_privilege('authenticated', 'public.match_event_authors', 'DELETE')
UNION ALL
-- match_transitions/app_config: anon+authenticated+ci_schema_reader duerfen lesen, niemand darf
-- per Rolle schreiben (nur eine NEUE Migration schreibt, siehe Migrationskommentare).
SELECT 'authenticated-no-insert-match-transitions',
       NOT has_table_privilege('authenticated', 'public.match_transitions', 'INSERT')
UNION ALL
SELECT 'authenticated-no-update-match-transitions',
       NOT has_table_privilege('authenticated', 'public.match_transitions', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-delete-match-transitions',
       NOT has_table_privilege('authenticated', 'public.match_transitions', 'DELETE')
UNION ALL
SELECT 'authenticated-no-insert-app-config',
       NOT has_table_privilege('authenticated', 'public.app_config', 'INSERT')
UNION ALL
SELECT 'authenticated-no-update-app-config',
       NOT has_table_privilege('authenticated', 'public.app_config', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-delete-app-config',
       NOT has_table_privilege('authenticated', 'public.app_config', 'DELETE')
UNION ALL
SELECT 'positive-authenticated-select-match-event-authors',
       has_table_privilege('authenticated', 'public.match_event_authors', 'SELECT')
UNION ALL
-- Abschluss-Fixrunde (final-review-B.md, I1): ohne diesen GRANT scheitert pg_dump --schema-only
-- (scripts/db-drift-check.sh, Live-Dump als ci_schema_reader) live mit "permission denied for
-- table match_event_authors", sobald diese Migration eingespielt ist -- die Tabelle hat (anders
-- als match_transitions/app_config) keine eigene SELECT-Policy fuer ci_schema_reader, RLS liefert
-- also weiterhin 0 Zeilen; dieser GRANT sichert nur den Schema-Dump ab, keinen Datenzugriff.
SELECT 'positive-ci-schema-reader-select-match-event-authors',
       has_table_privilege('ci_schema_reader', 'public.match_event_authors', 'SELECT')
UNION ALL
SELECT 'positive-anon-select-match-transitions',
       has_table_privilege('anon', 'public.match_transitions', 'SELECT')
UNION ALL
SELECT 'positive-ci-schema-reader-select-match-transitions',
       has_table_privilege('ci_schema_reader', 'public.match_transitions', 'SELECT')
UNION ALL
SELECT 'positive-anon-select-app-config',
       has_table_privilege('anon', 'public.app_config', 'SELECT')
UNION ALL
SELECT 'positive-ci-schema-reader-select-app-config',
       has_table_privilege('ci_schema_reader', 'public.app_config', 'SELECT')
UNION ALL
-- B3a (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3a-brief.md, R17; Fixrunde 1: Review
-- M7, Ruling S12) -- SQL-Rechenfunktion (supabase/migrations/20260928_002_match_engine.sql):
-- 6 Funktionen in public + 35 interne Teilfunktionen im nicht exponierten Schema match_engine = 41.
-- compute_match_state ist STABLE, die anderen 40 IMMUTABLE; keine ist SECURITY DEFINER (RLS gilt);
-- alle haben search_path=public, pg_temp; keine hat EXECUTE fuer PUBLIC (auch nicht implizit:
-- proacl IS NULL hiesse Standard-EXECUTE fuer PUBLIC); das Schema match_engine hat kein USAGE fuer
-- PUBLIC; in public liegt kein match__-Helfer mehr. Die Zahlen sind fest, damit ein fehlender
-- Einspielvorgang nicht vakuum-gruen wird -- neue Helfer muessen sie mitziehen. B3b
-- (20260928_003) fuegt sechs IMMUTABLE-Helfer in match_engine hinzu: 41 + 6 = 47 (46 IMMUTABLE).
SELECT 'compute-match-state-security-invoker',
       NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = 'public.compute_match_state(uuid)'::regprocedure)
UNION ALL
SELECT 'compute-match-state-stable',
       (SELECT p.provolatile = 's' FROM pg_proc p WHERE p.oid = 'public.compute_match_state(uuid)'::regprocedure)
UNION ALL
SELECT 'match-apply-event-immutable',
       (SELECT p.provolatile = 'i' FROM pg_proc p
         WHERE p.oid = 'public.match_apply_event(jsonb,jsonb,jsonb,jsonb)'::regprocedure)
UNION ALL
SELECT 'match-engine-function-count-47',
       (SELECT count(*) = 47 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE (n.nspname = 'match_engine'
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))))
UNION ALL
SELECT 'match-engine-immutable-count-46',
       (SELECT count(*) = 46 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE (n.nspname = 'match_engine'
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))) AND p.provolatile = 'i')
UNION ALL
SELECT 'match-engine-no-security-definer',
       (SELECT count(*) = 0 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE (n.nspname = 'match_engine'
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))) AND p.prosecdef)
UNION ALL
SELECT 'match-engine-search-path-all-47',
       (SELECT count(*) = 47 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE (n.nspname = 'match_engine'
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))) AND p.proconfig = ARRAY['search_path=public, pg_temp'])
UNION ALL
SELECT 'match-engine-functions-no-public-execute',
       (SELECT count(*) = 0 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE (n.nspname = 'match_engine'
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))) AND (p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)))
UNION ALL
SELECT 'match-engine-schema-no-public-usage',
       (SELECT n.nspacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(n.nspacl) a WHERE a.grantee = 0)
          FROM pg_namespace n WHERE n.nspname = 'match_engine')
UNION ALL
SELECT 'no-match-helpers-in-public',
       NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname LIKE 'match\_\_%')
UNION ALL
SELECT 'positive-anon-execute-compute-match-state',
       has_function_privilege('anon', 'public.compute_match_state(uuid)', 'EXECUTE')
UNION ALL
SELECT 'positive-authenticated-execute-compute-match-state',
       has_function_privilege('authenticated', 'public.compute_match_state(uuid)', 'EXECUTE')
UNION ALL
SELECT 'positive-authenticated-execute-match-apply-event',
       has_function_privilege('authenticated', 'public.match_apply_event(jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')
UNION ALL
SELECT 'positive-anon-usage-match-engine',
       has_schema_privilege('anon', 'match_engine', 'USAGE')
UNION ALL
SELECT 'positive-anon-execute-match-engine-payload-valid',
       has_function_privilege('anon', 'match_engine.payload_valid(jsonb,jsonb)', 'EXECUTE')
UNION ALL
-- B3b (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3b-brief.md, R17) -- Schreibweg
-- (supabase/migrations/20260928_003_append_match_events.sql): append_match_events ist SECURITY
-- DEFINER mit festem search_path, EXECUTE nur authenticated (nicht PUBLIC, nicht anon);
-- server_time ist STABLE und fuer anon + authenticated ausfuehrbar; die sechs B3b-Helfer in
-- match_engine braucht nur der Definer (kein EXECUTE fuer anon/authenticated).
SELECT 'append-match-events-security-definer',
       (SELECT p.prosecdef FROM pg_proc p
         WHERE p.oid = 'public.append_match_events(uuid,jsonb,integer,uuid)'::regprocedure)
UNION ALL
SELECT 'append-match-events-search-path',
       (SELECT p.proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc p
         WHERE p.oid = 'public.append_match_events(uuid,jsonb,integer,uuid)'::regprocedure)
UNION ALL
SELECT 'append-match-events-no-public-execute',
       (SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
          FROM pg_proc p WHERE p.oid = 'public.append_match_events(uuid,jsonb,integer,uuid)'::regprocedure)
UNION ALL
SELECT 'anon-no-execute-append-match-events',
       NOT has_function_privilege('anon', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE')
UNION ALL
SELECT 'server-time-stable',
       (SELECT p.provolatile = 's' AND NOT p.prosecdef FROM pg_proc p WHERE p.oid = 'public.server_time()'::regprocedure)
UNION ALL
-- Fixrunde 1 (Review M7): alle sechs B3b-Helfer fuer anon, authenticated UND service_role gesperrt.
SELECT 'b3b-helpers-no-execute-anon-authenticated-service-role',
       NOT EXISTS (
         SELECT 1
           FROM unnest(ARRAY['match_engine.normalize_uuid(jsonb)', 'match_engine.cfg_num(jsonb)',
                             'match_engine.envelope(jsonb,text,text)', 'match_engine.dedupe_key(jsonb)',
                             'match_engine.server_rules(integer,text,integer,integer,jsonb,jsonb)',
                             'match_engine.cache_columns(jsonb,jsonb)']) AS f(sig)
          CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r(role)
          WHERE has_function_privilege(r.role, f.sig, 'EXECUTE'))
UNION ALL
-- Fixrunde 1 (Nachtrag C3): service_role hat keinen EXECUTE auf append_match_events -- ohne
-- auth.uid() waere der Aufruf ohnehin wirkungslos (42501); least privilege.
SELECT 'service-role-no-execute-append-match-events',
       NOT has_function_privilege('service_role', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE')
UNION ALL
SELECT 'positive-authenticated-execute-append-match-events',
       has_function_privilege('authenticated', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE')
UNION ALL
SELECT 'positive-anon-execute-server-time',
       has_function_privilege('anon', 'public.server_time()', 'EXECUTE')
UNION ALL
SELECT 'positive-authenticated-execute-server-time',
       has_function_privilege('authenticated', 'public.server_time()', 'EXECUTE')
;
