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
-- C0b (20261001_001_amend_event.sql) fuegt vier IMMUTABLE-Helfer hinzu (detail_value_valid,
-- detail_fields, details_from_payload, apply_amend) und ersetzt enter_decision(jsonb,text) durch
-- enter_decision(jsonb,text,numeric): 47 + 4 = 51 (50 IMMUTABLE).
-- A-02 (20261003_001_match_slots.sql) fuegt den IMMUTABLE-Pruefhelfer slot_source_valid(jsonb) fuer
-- die CHECKs matches_slot_x_source_valid hinzu: 51 + 1 = 52 (51 IMMUTABLE).
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
-- A-13b-S (20261110_006): Zaehlung und Eigenschaften gelten fuer die Rechenfunktion; die zehn Hilfen fuer „Gruppe
-- abschliessen“ (group_key ... conflict_or_reject) im selben Schema sind ausgenommen und eigens geprueft.
SELECT 'match-engine-function-count-52',
       (SELECT count(*) = 52 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE ((n.nspname = 'match_engine' AND p.proname NOT IN ('group_key', 'group_state', 'places_to_play_out', 'same_team_set', 'standing_decision_valid', 'shared_allowed', 'write_side', 'add_notice', 'apply_follow_up', 'conflict_or_reject'))
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))))
UNION ALL
SELECT 'match-engine-immutable-count-51',
       (SELECT count(*) = 51 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE ((n.nspname = 'match_engine' AND p.proname NOT IN ('group_key', 'group_state', 'places_to_play_out', 'same_team_set', 'standing_decision_valid', 'shared_allowed', 'write_side', 'add_notice', 'apply_follow_up', 'conflict_or_reject'))
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))) AND p.provolatile = 'i')
UNION ALL
SELECT 'match-engine-no-security-definer',
       (SELECT count(*) = 0 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE (n.nspname = 'match_engine'
              OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event',
                  'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'))) AND p.prosecdef)
UNION ALL
SELECT 'match-engine-search-path-all-52',
       (SELECT count(*) = 52 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE ((n.nspname = 'match_engine' AND p.proname NOT IN ('group_key', 'group_state', 'places_to_play_out', 'same_team_set', 'standing_decision_valid', 'shared_allowed', 'write_side', 'add_notice', 'apply_follow_up', 'conflict_or_reject'))
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
                             'match_engine.server_rules(integer,text,integer,integer,jsonb,jsonb,text)',
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
UNION ALL
-- C0b (.superpowers/sdd/2026-09-26-pr-c-ausgang/task-C0b-brief.md, 20261001_001_amend_event.sql):
-- die alte enter_decision-Signatur ist entfernt; alle Engine-Teilfunktionen ausser den sechs
-- definer-only B3b-Helfern sind fuer anon UND authenticated ausfuehrbar (compute_match_state ist
-- SECURITY INVOKER -- fehlt ein Grant, scheitert es sonst erst zur Laufzeit, Review M5); der
-- Spalten-Schutz-Trigger auf matches (V4, Ruling PC2) existiert, ist aktiv, BEFORE UPDATE je Zeile,
-- seine Funktion ist SECURITY INVOKER (current_user-Unterscheidung) mit festem search_path und ohne
-- EXECUTE fuer PUBLIC; sein Helfer public.match_has_engine_events ist SECURITY DEFINER (Fixrunde 1,
-- M1) mit festem search_path, EXECUTE genau fuer anon/authenticated (nicht PUBLIC, nicht
-- service_role). Fixrunde 1 (M6): Objekte ueber to_regprocedure() -- fehlt eines (z. B. live vor
-- dem Einspielen, V7), liefert die Zeile "f" statt die ganze Abfrage abzubrechen.
SELECT 'no-enter-decision-without-at',
       to_regprocedure('match_engine.enter_decision(jsonb,text)') IS NULL
UNION ALL
SELECT 'match-engine-non-b3b-executable-anon-authenticated',
       (SELECT count(*) > 0 AND bool_and(has_function_privilege('anon', p.oid, 'EXECUTE')
                                          AND has_function_privilege('authenticated', p.oid, 'EXECUTE'))
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'match_engine'
           AND p.proname NOT IN ('normalize_uuid', 'cfg_num', 'envelope', 'dedupe_key', 'server_rules', 'cache_columns')
           -- A-13b-S (20261110_006): die Hilfen fuer „Gruppe abschliessen“ liegen in match_engine, sind aber nur aus den
           -- Server-Funktionen erreichbar (eigene Assertion group-completion-helpers-no-client-execute).
           AND p.proname NOT IN ('group_key', 'group_state', 'places_to_play_out', 'same_team_set', 'standing_decision_valid', 'shared_allowed', 'write_side', 'add_notice', 'apply_follow_up', 'conflict_or_reject'))
UNION ALL
SELECT 'positive-anon-execute-match-engine-apply-amend',
       coalesce(has_function_privilege('anon', to_regprocedure('match_engine.apply_amend(jsonb,jsonb)'), 'EXECUTE'), false)
UNION ALL
SELECT 'matches-guard-engine-columns-trigger-active',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.matches') AND t.tgname = 'matches_guard_engine_columns'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.matches_guard_engine_columns()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'matches-guard-engine-columns-invoker-search-path',
       coalesce((SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.matches_guard_engine_columns()')), false)
UNION ALL
SELECT 'matches-guard-engine-columns-no-public-execute',
       coalesce((SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_guard_engine_columns()')), false)
UNION ALL
SELECT 'match-has-engine-events-definer-search-path',
       coalesce((SELECT p.prosecdef AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.match_has_engine_events(uuid)')), false)
UNION ALL
SELECT 'match-has-engine-events-execute-only-anon-authenticated',
       coalesce((SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.match_has_engine_events(uuid)')), false)
-- A-36a (20261026_001_match_origin.sql): Herkunft des Platzes unveraenderlich. Trigger BEFORE UPDATE
-- (ROW, BEFORE, UPDATE) aktiv, Trigger-Funktion in public ohne PUBLIC-EXECUTE. Die Zaehlung der
-- match_engine-Funktionen (52) bleibt, die Funktion liegt in public. Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'matches-keep-origin-trigger-active',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.matches') AND t.tgname = 'matches_keep_origin'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.matches_keep_origin()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'matches-keep-origin-no-public-execute',
       coalesce((SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_keep_origin()')), false)
-- A-30a (20261028_004_match_kit_colors.sql): getragene Farben. Trigger AFTER INSERT ROW auf match_events (nur
-- MATCH_START, WHEN-Bedingung) und BEFORE INSERT OR UPDATE ROW auf matches aktiv; beide Funktionen in public ohne
-- EXECUTE fuer PUBLIC, anon, authenticated; die Projektion ist SECURITY DEFINER, der Schutz SECURITY INVOKER
-- (current_user-Unterscheidung), beide mit festem search_path. Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'match-events-kit-from-match-start-trigger-active',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.match_events') AND t.tgname = 'match_events_kit_from_match_start'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.matches_kit_from_match_start()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 0 AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 0
                  AND pg_get_triggerdef(t.oid) LIKE '%WHEN ((new.type = ''MATCH_START''::text))%')
UNION ALL
SELECT 'matches-guard-kit-columns-trigger-active',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.matches') AND t.tgname = 'matches_guard_kit_columns'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.matches_guard_kit_columns()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'matches-kit-from-match-start-definer-no-client-execute',
       coalesce((SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp']
                        AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_kit_from_match_start()')), false)
UNION ALL
SELECT 'matches-guard-kit-columns-invoker-no-client-execute',
       coalesce((SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp']
                        AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_guard_kit_columns()')), false)
UNION ALL
-- A-08h (Befund C-MATCH-EVENTS-DIREKTWEG, @FU-084, @FU-085): Clients schreiben match_events nur noch
-- über append_match_events (SECURITY DEFINER). anon und authenticated haben KEIN INSERT/UPDATE/DELETE
-- auf der Tabelle; SELECT bleibt (Gegenbeispiel unten). Ohne Tabellenrecht kommt ein eindeutiges 42501.
SELECT 'anon-no-insert-match-events',
       NOT has_table_privilege('anon', 'public.match_events', 'INSERT')
UNION ALL
SELECT 'anon-no-update-match-events',
       NOT has_table_privilege('anon', 'public.match_events', 'UPDATE')
UNION ALL
SELECT 'anon-no-delete-match-events',
       NOT has_table_privilege('anon', 'public.match_events', 'DELETE')
UNION ALL
SELECT 'authenticated-no-insert-match-events',
       NOT has_table_privilege('authenticated', 'public.match_events', 'INSERT')
UNION ALL
SELECT 'authenticated-no-update-match-events',
       NOT has_table_privilege('authenticated', 'public.match_events', 'UPDATE')
UNION ALL
SELECT 'authenticated-no-delete-match-events',
       NOT has_table_privilege('authenticated', 'public.match_events', 'DELETE')
UNION ALL
-- Gegenbeispiel: Lesen bleibt (Zuschauer, Monitor, Realtime; match_events_select_v3).
SELECT 'authenticated-select-match-events',
       has_table_privilege('authenticated', 'public.match_events', 'SELECT')
UNION ALL
-- Policy-Ebene: has_table_privilege sieht RLS nicht. Auf match_events gibt es daher keine Policy
-- ausser SELECT (kein INSERT/UPDATE/DELETE/ALL, egal fuer welche Rolle).
SELECT 'match-events-only-select-policy',
       NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'match_events' AND cmd <> 'SELECT')
-- A-10 (20261028_005_guard_all_matches.sql, @EK-060, @FU-090, @TM-027): Spalten-Schutz fuer ALLE Spiele
-- (BEFORE INSERT OR UPDATE, Funktion ohne die Bedingung match_has_engine_events -- faengt die Rueckkehr der
-- Bedingung live), reset_match_results (SECURITY DEFINER, EXECUTE nur authenticated), Zaehlung
-- tournaments.change_revision (Bump-Trigger AFTER UPDATE als SECURITY DEFINER, Schutz-Trigger BEFORE INSERT OR
-- UPDATE als SECURITY INVOKER; beide ohne EXECUTE fuer Clients). Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'matches-guard-engine-columns-insert-and-update',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.matches') AND t.tgname = 'matches_guard_engine_columns'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.matches_guard_engine_columns()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'matches-guard-engine-columns-unconditional',
       coalesce((SELECT p.prosrc NOT LIKE '%match_has_engine_events%' FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.matches_guard_engine_columns()')), false)
UNION ALL
SELECT 'reset-match-results-definer-search-path',
       coalesce((SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.reset_match_results(uuid,uuid[])')), false)
UNION ALL
SELECT 'reset-match-results-execute-only-authenticated',
       coalesce((SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
                        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.reset_match_results(uuid,uuid[])')), false)
UNION ALL
SELECT 'matches-bump-change-revision-trigger-active',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.matches') AND t.tgname = 'matches_bump_change_revision'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.matches_bump_change_revision()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 0 AND (t.tgtype & 4) = 0 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'matches-bump-change-revision-definer-no-client-execute',
       coalesce((SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp']
                        AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_bump_change_revision()')), false)
UNION ALL
SELECT 'tournaments-guard-change-revision-trigger-active',
       EXISTS (SELECT 1 FROM pg_trigger t
                WHERE t.tgrelid = to_regclass('public.tournaments') AND t.tgname = 'tournaments_guard_change_revision'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O'
                  AND t.tgfoid = to_regprocedure('public.tournaments_guard_change_revision()')
                  AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16)
UNION ALL
SELECT 'tournaments-guard-change-revision-invoker-no-client-execute',
       coalesce((SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp']
                        AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.tournaments_guard_change_revision()')), false)
-- UR (20261028_006_event_author_names.sql, @FU-080, @FU-082, @FU-065): Lesefunktion fuer die Namen der Urheber
-- von Spiel-Eintraegen (SECURITY DEFINER, STABLE, fester search_path; EXECUTE nur authenticated -- anon,
-- service_role und PUBLIC nicht, @FU-065: keine Konto-Angabe fuer Zuschauer/oeffentliche Ansicht).
-- Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'match-event-author-names-definer-search-path',
       coalesce((SELECT p.prosecdef AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.match_event_author_names(uuid)')), false)
UNION ALL
SELECT 'match-event-author-names-execute-only-authenticated',
       coalesce((SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
                        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.match_event_author_names(uuid)')), false)
-- SW (20261028_007_entered_shootout_needs_draw.sql, @EK-062): cache_columns nach 20261028_007 -- IMMUTABLE, kein
-- SECURITY DEFINER, fester search_path, kein EXECUTE fuer PUBLIC/anon/authenticated/service_role (nur
-- append_match_events ruft sie als Definer). Regressionswache: schon VOR dem Live-Einspielen "t" (Rechte unveraendert).
UNION ALL
SELECT 'cache-columns-immutable-no-client-execute',
       coalesce((SELECT p.provolatile = 'i' AND NOT p.prosecdef
                        AND p.proconfig = ARRAY['search_path=public, pg_temp']
                        AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0)
                        AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r(role)
                                         WHERE has_function_privilege(r.role, p.oid, 'EXECUTE'))
                   FROM pg_proc p WHERE p.oid = to_regprocedure('match_engine.cache_columns(jsonb,jsonb)')), false)

-- A-11 (20261110_001_role_permissions_mvp.sql, @ZP-041, @ZM-019, @HE-042): Rechte-Namen inkl. der fuenf MVP-Rechte im
-- CHECK von role_permissions; genau eine UPDATE-Policy auf matches, die (USING und WITH CHECK) manageSchedule prueft
-- und writeMatchData nicht mehr; je eine INSERT-/UPDATE-/DELETE-Policy auf monitors ueber manageScreens statt owner_id.
-- Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'role-permissions-check-mvp-rights',
       coalesce((SELECT bool_and(position(quote_literal(r.name) IN pg_get_constraintdef(c.oid)) > 0)
                   FROM pg_constraint c
                   CROSS JOIN unnest(ARRAY['writeMatchData', 'correctEvents', 'tournamentSettings', 'teams', 'restructure',
                                           'deleteTournament', 'manageMembers', 'leadMatches', 'manageSchedule',
                                           'manageLifecycle', 'manageScreens', 'manageHelpers', 'readDisplay']) AS r(name)
                  WHERE c.conrelid = to_regclass('public.role_permissions') AND c.conname = 'role_permissions_permission_check'), false)
UNION ALL
SELECT 'matches-update-only-manage-schedule',
       coalesce((SELECT count(*) = 1
                        AND bool_and(position('manageSchedule' IN coalesce(p.qual, '')) > 0
                                     AND position('manageSchedule' IN coalesce(p.with_check, '')) > 0)
                        AND NOT bool_or(position('writeMatchData' IN coalesce(p.qual, '') || coalesce(p.with_check, '')) > 0)
                   FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'matches' AND p.cmd = 'UPDATE'), false)
UNION ALL
SELECT 'monitors-writes-manage-screens',
       coalesce((SELECT count(*) FILTER (WHERE p.cmd = 'INSERT') = 1
                        AND count(*) FILTER (WHERE p.cmd = 'UPDATE') = 1
                        AND count(*) FILTER (WHERE p.cmd = 'DELETE') = 1
                        AND bool_and(position('manageScreens' IN coalesce(p.qual, '') || coalesce(p.with_check, '')) > 0)
                        AND NOT bool_or(position('owner_id' IN coalesce(p.qual, '') || coalesce(p.with_check, '')) > 0)
                   FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'monitors' AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE')), false)

-- A-27 (20261110_002_device_roles.sql, @HE-082, @AN-045, @AN-006, @ME-059, @HE-062; C-ANON-POLICIES, C-REG):
-- Geraete-Rollen in beiden Rollen-CHECKs; has_tournament_permission laesst anonyme Sitzungen nur mit Geraete-Rolle zu;
-- genau eine INSERT-Policy auf tournaments (nur echtes Konto) und die 3-Turniere-Regel ist weg; anon hat auf keiner
-- public-Tabelle Schreibrechte (faengt auch kuenftige Tabellen); Guard-Trigger aktiv; Registrierungs-Hook nur fuer den
-- Auth-Dienst ausfuehrbar. Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'role-checks-device-roles',
       coalesce((SELECT count(*) = 2 AND bool_and(position('''helper''' IN pg_get_constraintdef(c.oid)) > 0
                                                AND position('''screen''' IN pg_get_constraintdef(c.oid)) > 0)
                   FROM pg_constraint c
                  WHERE (c.conrelid = to_regclass('public.tournament_collaborators') AND c.conname = 'tournament_collaborators_role_check')
                     OR (c.conrelid = to_regclass('public.role_permissions') AND c.conname = 'role_permissions_role_check')), false)
UNION ALL
SELECT 'has-permission-device-roles-for-anonymous',
       coalesce((SELECT position('is_real_account' IN pg_get_functiondef(p.oid)) > 0
                        AND position('''helper'', ''screen''' IN pg_get_functiondef(p.oid)) > 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.has_tournament_permission(uuid,text)')), false)
UNION ALL
SELECT 'tournaments-insert-real-account-only',
       coalesce((SELECT count(*) = 1 AND bool_and(position('is_real_account' IN coalesce(p.with_check, '')) > 0)
                   FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'tournaments' AND p.cmd = 'INSERT'), false)
       AND to_regprocedure('public.anonymous_tournament_limit()') IS NULL
UNION ALL
SELECT 'anon-no-write-public-tables',
       NOT EXISTS (SELECT 1 FROM pg_class c
                    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
                      AND (has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE')
                           OR has_table_privilege('anon', c.oid, 'DELETE') OR has_table_privilege('anon', c.oid, 'TRUNCATE')))
UNION ALL
SELECT 'device-roles-guard-trigger',
       coalesce((SELECT t.tgenabled = 'O'
                        AND (t.tgtype & 2) <> 0     -- BEFORE
                        AND (t.tgtype & 1) <> 0     -- FOR EACH ROW
                        AND (t.tgtype & 4) <> 0     -- INSERT
                        AND (t.tgtype & 16) <> 0    -- UPDATE
                        AND t.tgfoid = to_regprocedure('public.protect_device_roles()')
                   FROM pg_trigger t
                  WHERE t.tgrelid = to_regclass('public.tournament_collaborators') AND t.tgname = 'protect_device_roles'
                    AND NOT t.tgisinternal), false)
UNION ALL
SELECT 'hook-before-user-created-auth-admin-only',
       coalesce((SELECT has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                        AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0)
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.hook_before_user_created(jsonb)')), false)
-- A-27 Fixrunde 1 (Review K1, @AN-006, C-ANON-ZU-KONTO): Trigger block_anonymous_upgrade auf auth.users aktiv (BEFORE UPDATE,
-- FOR EACH ROW), Funktion ohne EXECUTE fuer PUBLIC/anon/authenticated. Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'auth-users-block-anonymous-upgrade',
       coalesce((SELECT t.tgenabled = 'O' AND (t.tgtype & 2) <> 0 AND (t.tgtype & 1) <> 0 AND (t.tgtype & 16) <> 0
                        AND t.tgfoid = to_regprocedure('public.block_anonymous_upgrade()')
                        AND NOT has_function_privilege('anon', t.tgfoid, 'EXECUTE')
                        AND NOT has_function_privilege('authenticated', t.tgfoid, 'EXECUTE')
                        AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                         WHERE p.oid = t.tgfoid AND a.grantee = 0)
                   FROM pg_trigger t
                   JOIN pg_class c ON c.oid = t.tgrelid
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  -- ueber den Katalog statt to_regclass('auth.users'): die CI-Leserolle hat kein USAGE auf Schema auth
                  WHERE n.nspname = 'auth' AND c.relname = 'users'
                    AND t.tgname = 'block_anonymous_upgrade' AND NOT t.tgisinternal), false)

-- A-34 (20261110_003_field_control.sql, @FU-026, @FU-027, @FU-030, @HE-049): Steuer je Feld. Tabelle field_control mit RLS,
-- ohne Policy und ohne Tabellenrechte fuer anon/authenticated (nur Definer-Funktionen); take_field_control und
-- field_control_state SECURITY DEFINER mit search_path, EXECUTE nur authenticated (nicht anon, nicht PUBLIC); die interne
-- field_control_info fuer keinen Client; append_match_events prueft die Steuer (geht beim Ersetzen der Funktion durch
-- eine spaetere Migration nicht still verloren, brief-A-34 L9). Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'field-control-no-client-access',
       coalesce((SELECT c.relrowsecurity
                        AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
                        AND NOT has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                        AND NOT has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                   FROM pg_class c WHERE c.oid = to_regclass('public.field_control')), false)
UNION ALL
SELECT 'field-control-rpcs-execute-only-authenticated',
       coalesce((SELECT count(*) = 2
                        AND bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
                                     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                                     AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                      WHERE a.grantee = 0))
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.take_field_control(uuid,integer,uuid,text,integer)'),
                                  to_regprocedure('public.field_control_state(uuid,uuid)'))), false)
       AND coalesce((SELECT NOT p.prosecdef
                            AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                            AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                            AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                             WHERE a.grantee = 0)
                       FROM pg_proc p WHERE p.oid = to_regprocedure('public.field_control_info(uuid,integer,uuid)')), false)
UNION ALL
SELECT 'append-match-events-checks-field-control',
       coalesce((SELECT position('public.field_control' IN pg_get_functiondef(p.oid)) > 0
                        AND position('''NOT_CONTROLLER''' IN pg_get_functiondef(p.oid)) > 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)')), false)

-- CA-2 (20261110_004_coadmin_einsatz.sql, @HE-085, @BM-070/@ME-070; C-SHARE, C-HEARTBEAT-NUR-EIGENTUEMER): die drei
-- Freigabe-Funktionen pruefen das Recht tournamentSettings (nicht mehr owner_id), SECURITY DEFINER mit search_path,
-- make_tournament_public behaelt die Freigabe-Sperre HF001 und gibt einen vorhandenen Code zurueck (Auflage 5);
-- monitor_heartbeats hat genau eine Policy, SELECT nur fuer authenticated ueber manageScreens (nicht owner_id,
-- nicht tournamentSettings -- Mutationsprobe M5 bliebe in der Matrix gruen, deshalb hier am Policy-Text).
-- Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'share-rpcs-permission-based',
       coalesce((SELECT count(*) = 3
                        AND bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
                                     AND position('has_tournament_permission(tournament_id, ''tournamentSettings'')' IN pg_get_functiondef(p.oid)) > 0
                                     AND position('owner_id' IN pg_get_functiondef(p.oid)) = 0)
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.make_tournament_public(uuid)'),
                                  to_regprocedure('public.make_tournament_private(uuid)'),
                                  to_regprocedure('public.regenerate_share_code(uuid)'))), false)
UNION ALL
SELECT 'make-public-keeps-existing-code',
       coalesce((SELECT position('''HF001''' IN pg_get_functiondef(p.oid)) > 0
                        AND position('IF v_is_public AND v_existing_code IS NOT NULL THEN' IN pg_get_functiondef(p.oid)) > 0
                        -- die Klausel selbst, nicht der Kommentar (Review CA-2 Auflage 5a)
                        AND pg_get_functiondef(p.oid) ~ 'WHERE t\.id = tournament_id\s+FOR UPDATE;'
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.make_tournament_public(uuid)')), false)
UNION ALL
SELECT 'heartbeats-select-manage-screens',
       coalesce((SELECT count(*) = 1
                        AND bool_and(p.cmd = 'SELECT' AND p.policyname = 'heartbeats_select_v2'
                                     AND p.roles = ARRAY['authenticated']::name[]
                                     AND position('''manageScreens''' IN coalesce(p.qual, '')) > 0
                                     AND position('owner_id' IN coalesce(p.qual, '')) = 0)
                   FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'monitor_heartbeats'), false)

-- A-25b (20261110_005_result_entry_forfeit.sql, @W2A-022, @W2A-024, @W2A-026; C-NICHTANTRITT-FEHLT): forfeit_absent ist
-- Schutzspalte (Client-Rollen aendern sie nie, INSERT neutral NULL) und append_match_events schreibt sie -- in der
-- Fassung MIT Feldsteuerung (Review-Auflage 4: Basis 20261110_003, sonst waere A-34 zurueckgedreht).
-- Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'matches-guard-engine-columns-forfeit-absent',
       coalesce((SELECT position('NEW.forfeit_absent := NULL;' IN p.prosrc) > 0
                        AND position('NEW.forfeit_absent IS DISTINCT FROM OLD.forfeit_absent' IN p.prosrc) > 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_guard_engine_columns()')), false)
UNION ALL
SELECT 'append-match-events-writes-forfeit-absent',
       coalesce((SELECT position('forfeit_absent = v_cache ->> ''forfeit_absent''' IN pg_get_functiondef(p.oid)) > 0
                        AND position('public.field_control' IN pg_get_functiondef(p.oid)) > 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)')), false)

-- A-13b-S (20261110_006_group_completion.sql, @TM-046, @TM-113, @W2A-070, @W2A-072; Plan § 8, Soll 12/13): Gruppe abschliessen
-- am Server. Vor dem Live-Einspielen: "f".
--  (1) Die vier Tabellen haben keine Client-Schreibrechte; anon liest keine; bracket_log hat gar kein Tabellenrecht
--      (Lesen nur ueber bracket_log_read); authenticated liest group_completions, bracket_notices, clarifications.
UNION ALL
SELECT 'group-completion-tables-no-client-writes',
       coalesce((SELECT bool_and(to_regclass('public.' || t) IS NOT NULL
                                 AND NOT has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                                 AND NOT has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                                 AND has_table_privilege('authenticated', 'public.' || t, 'SELECT') = (t <> 'bracket_log'))
                   FROM unnest(ARRAY['group_completions', 'bracket_log', 'bracket_notices', 'clarifications']) AS t), false)
--  (2) Die sechs RPCs: SECURITY DEFINER mit festem search_path, nur authenticated darf sie ausfuehren.
UNION ALL
SELECT 'group-completion-rpcs-definer-authenticated-only',
       coalesce((SELECT count(*) = 6
                        AND bool_and(p.prosecdef AND p.proconfig IS NOT NULL
                                     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.record_standing_decision(uuid,text,jsonb,text,integer)'),
                                  to_regprocedure('public.complete_group(uuid,text,uuid[],integer[],jsonb,text[],jsonb,boolean)'),
                                  to_regprocedure('public.reopen_group(uuid,text,text,boolean)'),
                                  to_regprocedure('public.resolve_bracket_notice(bigint)'),
                                  to_regprocedure('public.resolve_clarification(bigint)'),
                                  to_regprocedure('public.bracket_log_read(uuid)'))), false)
--  (3) Die Hilfen in match_engine sind nur aus den Server-Funktionen erreichbar (kein EXECUTE fuer Client-Rollen) und
--      haben einen festen search_path (Review A-13b-S, Soll).
UNION ALL
SELECT 'group-completion-helpers-no-client-execute',
       coalesce((SELECT count(*) = 10
                        AND bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                                     AND p.proconfig = ARRAY['search_path=public, pg_temp'])
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('match_engine.group_key(text)'),
                                  to_regprocedure('match_engine.group_state(uuid,text)'),
                                  to_regprocedure('match_engine.places_to_play_out(jsonb)'),
                                  to_regprocedure('match_engine.same_team_set(jsonb,jsonb)'),
                                  to_regprocedure('match_engine.standing_decision_valid(jsonb)'),
                                  to_regprocedure('match_engine.shared_allowed(uuid,text,integer[],jsonb)'),
                                  to_regprocedure('match_engine.write_side(uuid,text,uuid,jsonb,boolean)'),
                                  to_regprocedure('match_engine.add_notice(uuid,uuid,text,text,uuid,uuid)'),
                                  to_regprocedure('match_engine.apply_follow_up(uuid,uuid,text,uuid,uuid,jsonb,jsonb,text,uuid,jsonb)'),
                                  to_regprocedure('match_engine.conflict_or_reject(boolean,uuid,uuid,text,text,jsonb,text,uuid)'))), false)
--  (4) Sperrreihenfolge R-GA4v2-8 (MG14): complete_group sperrt die Spiele vor der Turnierzeile.
UNION ALL
SELECT 'complete-group-locks-matches-before-tournament',
       coalesce((SELECT position('ORDER BY m.id' IN p.prosrc) > 0
                        AND position('ORDER BY m.id' IN p.prosrc)
                            < position('FROM public.tournaments WHERE id = p_tournament_id' IN p.prosrc)
                   FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.complete_group(uuid,text,uuid[],integer[],jsonb,text[],jsonb,boolean)')), false)
--  (5) Trigger: Korrektur macht einen Abschluss stale (SECURITY DEFINER, MG10); Voll-Speichern behaelt die Entscheidungen
--      (Soll 12, MG15); reassigned_at schreibt nur der Server (Soll 13).
UNION ALL
SELECT 'group-completion-triggers',
       coalesce((SELECT count(*) = 3 FROM pg_trigger tg
                  WHERE NOT tg.tgisinternal AND tg.tgenabled <> 'D'
                    AND ((tg.tgrelid = 'public.matches'::regclass AND tg.tgname = 'matches_mark_group_stale'
                          AND tg.tgqual IS NOT NULL
                          AND (SELECT prosecdef FROM pg_proc WHERE oid = tg.tgfoid))
                      OR (tg.tgrelid = 'public.matches'::regclass AND tg.tgname = 'matches_guard_ga4_columns'
                          AND position('reassigned_at' IN (SELECT prosrc FROM pg_proc WHERE oid = tg.tgfoid)) > 0)
                      OR (tg.tgrelid = 'public.tournaments'::regclass AND tg.tgname = 'tournaments_keep_standing_decisions'
                          AND position('standingDecisions' IN (SELECT prosrc FROM pg_proc WHERE oid = tg.tgfoid)) > 0))), false)
--  (6) Leserolle des Drift-Checks (Daniel 21.10., ci-grants-sql-freigabe.md § 8): ci_schema_reader liest die vier Tabellen
--      (pg_dump --schema-only sperrt jede Tabelle und braucht SELECT), und NUR lesen.
UNION ALL
SELECT 'ci-schema-reader-select-group-completion',
       coalesce((SELECT bool_and(to_regclass('public.' || t) IS NOT NULL
                                 AND has_table_privilege('ci_schema_reader', 'public.' || t, 'SELECT')
                                 AND NOT has_table_privilege('ci_schema_reader', 'public.' || t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
                   FROM unnest(ARRAY['group_completions', 'bracket_log', 'bracket_notices', 'clarifications']) AS t), false)
-- A-16 (20261110_008_helper_join.sql, @HE-004 @HE-062 @HE-073 @HE-084 @HE-104 @HE-105; C-HELFER-OHNE-KONTO): Helfer-Beitritt
-- per QR. Zwei Tabellen ohne Client-Rechte (RLS an, keine Policy; ci_schema_reader liest fuer den Schema-Dump, ohne
-- BYPASSRLS); zehn Client-Funktionen SECURITY DEFINER mit search_path und Eigentuemer postgres, EXECUTE nur authenticated
-- (join_code_info zusaetzlich anon, Scan ohne Sitzung); interne Funktionen fuer keinen Client; Positivliste der
-- Definer-Schreiber auf tournament_collaborators (M4a, B-20 erweitert sie ausdruecklich); Loesch-Policy schuetzt
-- Geraete-Zeilen (M2); protect_collaborator_row in der A-16-Fassung (md5, M4; Durchgang nur mit dem Schalter, den
-- change_helper_access nur um seine UPDATEs setzt, Review M-1); Pruefzahl am Server (S-1); Rollen-Schutz
-- der Geraete-Zeilen (K-3); keine verborgenen Zeichen in Namen (S-4). Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'helper-join-tables-no-client-access',
       coalesce((SELECT count(*) = 2
                        AND bool_and(c.relrowsecurity
                                     AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
                                     AND NOT has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                                     AND NOT has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'))
                   FROM pg_class c
                  WHERE c.oid IN (to_regclass('public.tournament_join_codes'), to_regclass('public.tournament_join_requests'))), false)
UNION ALL
SELECT 'helper-join-ci-schema-reader-select',
       coalesce(has_table_privilege('ci_schema_reader', to_regclass('public.tournament_join_codes'), 'SELECT')
                AND has_table_privilege('ci_schema_reader', to_regclass('public.tournament_join_requests'), 'SELECT'), false)
UNION ALL
SELECT 'helper-join-ci-schema-reader-no-bypassrls',
       coalesce((SELECT NOT r.rolbypassrls FROM pg_roles r WHERE r.rolname = 'ci_schema_reader'), false)
UNION ALL
SELECT 'helper-join-rpcs-definer-owner-search-path',
       coalesce((SELECT count(*) = 11
                        AND bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
                                     AND pg_get_userbyid(p.proowner) = 'postgres'
                                     AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                      WHERE a.grantee = 0))
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.join_code_info(text)'),
                                  to_regprocedure('public.request_helper_access(text,text,text)'),
                                  to_regprocedure('public.helper_access_status(uuid)'),
                                  to_regprocedure('public.ensure_helper_code(uuid)'),
                                  to_regprocedure('public.rotate_helper_code(uuid,text)'),
                                  to_regprocedure('public.list_helper_access(uuid)'),
                                  to_regprocedure('public.helper_request_count(uuid)'),
                                  to_regprocedure('public.decide_join_request(uuid,boolean,integer,smallint)'),
                                  to_regprocedure('public.change_helper_access(uuid,text)'),
                                  to_regprocedure('public.match_event_author_devices(uuid)'),
                                  to_regprocedure('public.is_device_membership(uuid,text)'))), false)
UNION ALL
SELECT 'helper-join-rpcs-execute-authenticated-only',
       coalesce((SELECT count(*) = 10
                        AND bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.request_helper_access(text,text,text)'),
                                  to_regprocedure('public.helper_access_status(uuid)'),
                                  to_regprocedure('public.ensure_helper_code(uuid)'),
                                  to_regprocedure('public.rotate_helper_code(uuid,text)'),
                                  to_regprocedure('public.list_helper_access(uuid)'),
                                  to_regprocedure('public.helper_request_count(uuid)'),
                                  to_regprocedure('public.decide_join_request(uuid,boolean,integer,smallint)'),
                                  to_regprocedure('public.change_helper_access(uuid,text)'),
                                  to_regprocedure('public.match_event_author_devices(uuid)'),
                                  to_regprocedure('public.is_device_membership(uuid,text)'))), false)
       AND coalesce(has_function_privilege('anon', to_regprocedure('public.join_code_info(text)'), 'EXECUTE')
                    AND has_function_privilege('authenticated', to_regprocedure('public.join_code_info(text)'), 'EXECUTE'), false)
UNION ALL
SELECT 'helper-join-internal-no-client-execute',
       coalesce((SELECT count(*) = 4
                        AND bool_and(NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                                     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                      WHERE a.grantee = 0))
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.helper_code_cutoff(date)'),
                                  to_regprocedure('public.tournament_closed_for_helpers(uuid)'),
                                  to_regprocedure('public.generate_helper_code()'),
                                  to_regprocedure('public.protect_helper_access_row()'))), false)
UNION ALL
SELECT 'helper-join-definer-writers-tournament-collaborators',
       coalesce((SELECT string_agg(p.proname, ',' ORDER BY p.proname)
                   FROM pg_proc p
                  WHERE p.pronamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace) AND p.prosecdef
                    AND p.prosrc ~* '(insert\s+into|update(\s+only)?|delete\s+from(\s+only)?)\s+("?public"?\s*\.\s*)?"?tournament_collaborators'),
                '') = 'change_helper_access,decide_join_request'
UNION ALL
SELECT 'helper-join-collaborators-delete-no-device-rows',
       coalesce((SELECT count(*) = 1
                        AND bool_and(p.policyname = 'collaborators_delete_v4' AND p.roles = ARRAY['authenticated']::name[]
                                     AND position('is_device_membership' IN coalesce(p.qual, '')) > 0)
                   FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = 'tournament_collaborators' AND p.cmd = 'DELETE'), false)
UNION ALL
SELECT 'helper-join-protect-collaborator-row-a16',
       coalesce((SELECT md5(p.prosrc) = '378a7e1ed6b72381c9b6924e0e664bc3'
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.protect_collaborator_row()')), false)
       AND coalesce((SELECT position('set_config(''hallenfussball.helper_access_write'', ''on'', true)' IN p.prosrc) > 0
                            AND position('set_config(''hallenfussball.helper_access_write'', '''', true)' IN p.prosrc) > 0
                       FROM pg_proc p WHERE p.oid = to_regprocedure('public.change_helper_access(uuid,text)')), false)
UNION ALL
SELECT 'helper-join-decide-checks-check-number',
       coalesce((SELECT position('p_check_number IS DISTINCT FROM v_req.check_number' IN p.prosrc) > 0
                        AND position('''CHECK_MISMATCH''' IN p.prosrc) > 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.decide_join_request(uuid,boolean,integer,smallint)')), false)
UNION ALL
SELECT 'helper-join-device-role-guard-trigger',
       coalesce((SELECT t.tgenabled = 'O' AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16
                        AND t.tgfoid = to_regprocedure('public.protect_helper_access_row()')
                   FROM pg_trigger t
                  WHERE t.tgrelid = to_regclass('public.tournament_collaborators') AND t.tgname = 'protect_helper_access_row'
                    AND NOT t.tgisinternal), false)
UNION ALL
SELECT 'helper-join-names-without-hidden-chars',
       coalesce((SELECT count(*) = 2
                        AND bool_and(position('u200B' IN pg_get_constraintdef(c.oid)) > 0
                                     AND position('u202E' IN pg_get_constraintdef(c.oid)) > 0)
                   FROM pg_constraint c
                  WHERE c.conrelid = to_regclass('public.tournament_join_requests') AND c.contype = 'c'
                    AND (pg_get_constraintdef(c.oid) LIKE '%display_name%' OR pg_get_constraintdef(c.oid) LIKE '%device_label%')), false)

-- B-14 (20261117_104_public_payload.sql, E-A2, @ZM-096..@ZM-102, @ME-018, Review Focus 6): oeffentliche Daten nur ueber
-- public_tournament/display_tournament (SECURITY DEFINER, EXECUTE anon+authenticated, nie PUBLIC); keine SELECT-Policy
-- fuer anon/public und keine mit is_public auf den acht Tabellen; Baustein public_view ohne Client-Rechte;
-- is_reading_member nur fuer authenticated; neue Tabellen in public ohne Standardrechte fuer anon
-- (C-ANON-STANDARDRECHTE-NEUE-TABELLEN). Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'public-read-functions-definer-execute-anon',
       coalesce((SELECT count(*) = 2
                        AND bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
                                     AND has_function_privilege('anon', p.oid, 'EXECUTE')
                                     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                      WHERE a.grantee = 0))
                   FROM pg_proc p
                  WHERE p.oid IN (to_regprocedure('public.public_tournament(text,bigint)'),
                                  to_regprocedure('public.display_tournament(uuid,text,bigint)'))), false)
UNION ALL
SELECT 'public-read-no-anon-select-policies',
       coalesce((SELECT count(*) = 8
                        AND NOT bool_or(p.roles && ARRAY['anon', 'public']::name[])
                        AND NOT bool_or(position('is_public' IN coalesce(p.qual, '')) > 0)
                   FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.cmd IN ('SELECT', 'ALL')
                    AND p.tablename IN ('tournaments', 'teams', 'team_players', 'matches', 'match_events', 'monitors',
                                        'sponsors', 'match_corrections')), false)
UNION ALL
SELECT 'public-read-view-schema-no-client-access',
       coalesce(to_regnamespace('public_view') IS NOT NULL
                AND NOT has_schema_privilege('anon', 'public_view', 'USAGE')
                AND NOT has_schema_privilege('authenticated', 'public_view', 'USAGE')
                AND NOT EXISTS (SELECT 1 FROM pg_proc p
                                 WHERE p.pronamespace = to_regnamespace('public_view')
                                   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                                        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))), false)
UNION ALL
SELECT 'public-read-reading-member-execute-only-authenticated',
       coalesce((SELECT p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
                        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                        AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                        AND position('''screen''' IN pg_get_functiondef(p.oid)) > 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.is_reading_member(uuid)')), false)
UNION ALL
SELECT 'public-read-default-privileges-no-anon',
       NOT EXISTS (SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a
                    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
                      AND d.defaclobjtype = 'r' AND a.grantee = 'anon'::regrole)
UNION ALL
SELECT 'public-read-reshare-keeps-code',
       coalesce((SELECT position('share_code = NULL' IN pg_get_functiondef(p.oid)) = 0
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.make_tournament_private(uuid)')), false)
       AND coalesce((SELECT position('IF v_existing_code IS NOT NULL THEN' IN pg_get_functiondef(p.oid)) > 0
                       FROM pg_proc p WHERE p.oid = to_regprocedure('public.make_tournament_public(uuid)')), false)
-- B-14 NB-1 (Review #346 Nachblick): Sicherheitskern unveraendert -- md5 der Funktionstexte (public_view.*,
-- public_tournament, display_tournament, is_reading_member; Reihenfolge Schema, Name, Argumente) wie in
-- 20261117_104_public_payload.sql, und die vier Trigger aus A1 aktiv. Aendert eine spaetere Migration eine dieser
-- Funktionen, muss der Wert hier mitgezogen werden (bewusst). Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'public-read-core-unchanged',
       coalesce((SELECT count(*) = 12
                        AND md5(string_agg(pg_get_functiondef(p.oid), E'\n'
                                           ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)))
                            = 'b066d903d80edc87778e7e65b2958366'
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public_view'
                     OR p.oid IN (to_regprocedure('public.public_tournament(text,bigint)'),
                                  to_regprocedure('public.display_tournament(uuid,text,bigint)'),
                                  to_regprocedure('public.is_reading_member(uuid)'))), false)
       AND (SELECT count(*) = 4 FROM pg_trigger t
             WHERE NOT t.tgisinternal AND t.tgenabled = 'O'
               AND (t.tgrelid, t.tgname) IN (('public.matches'::regclass, 'matches_updated_at_insert'),
                                             ('public.teams'::regclass, 'teams_updated_at_insert'),
                                             ('public.matches'::regclass, 'matches_public_structure_delete'),
                                             ('public.teams'::regclass, 'teams_public_structure_delete')))
-- B-48b (20261113_101_monitor_heartbeat_wake_lock.sql, @ME-064, @ME-026/@ME-027 Datenteil; Befund C-HEARTBEAT): genau
-- eine record_monitor_heartbeat mit Kennung als Text und p_wake_lock, SECURITY DEFINER mit search_path, EXECUTE nur
-- anon/authenticated (nicht PUBLIC), prueft gegen config -> 'monitors', den Papierkorb und tournamentSettings (Rumpf am
-- Text, sonst blieben M1/M2-Mutanten der Matrix im Katalog unsichtbar); monitor_heartbeats mit Kennung als Text,
-- Schluessel (tournament_id, monitor_id), ohne FK auf die unbenutzte Tabelle monitors, Pruefregel wake_lock aktiv.
-- Vor dem Live-Einspielen: "f".
UNION ALL
SELECT 'monitor-heartbeat-rpc-checks-config-monitors',
       coalesce((SELECT count(*) = 1
                        AND bool_and(pg_get_function_identity_arguments(p.oid) = 'p_monitor_key text, p_tournament_id uuid, p_slide_index integer, p_cache_status text, p_user_agent text, p_wake_lock text'
                                     AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
                                     AND has_function_privilege('anon', p.oid, 'EXECUTE')
                                     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                     AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                      WHERE a.grantee = 0)
                                     AND position('t.config -> ''monitors''' IN p.prosrc) > 0
                                     AND position('m.item ->> ''id'' = p_monitor_key' IN p.prosrc) > 0
                                     AND position('t.deleted_at IS NULL' IN p.prosrc) > 0
                                     AND position('public.has_tournament_permission(t.id, ''tournamentSettings'')' IN p.prosrc) > 0)
                   FROM pg_proc p
                  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'record_monitor_heartbeat'), false)
UNION ALL
SELECT 'monitor-heartbeat-key-per-tournament-wake-lock',
       coalesce((SELECT format_type(a.atttypid, a.atttypmod) = 'text'
                   FROM pg_attribute a
                  WHERE a.attrelid = to_regclass('public.monitor_heartbeats') AND a.attname = 'monitor_id' AND NOT a.attisdropped), false)
       AND coalesce((SELECT pg_get_constraintdef(c.oid) = 'PRIMARY KEY (tournament_id, monitor_id)'
                       FROM pg_constraint c WHERE c.conrelid = to_regclass('public.monitor_heartbeats') AND c.contype = 'p'), false)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c
                        WHERE c.conrelid = to_regclass('public.monitor_heartbeats') AND c.contype = 'f'
                          AND c.confrelid = to_regclass('public.monitors'))
       AND EXISTS (SELECT 1 FROM pg_constraint c
                    WHERE c.conrelid = to_regclass('public.monitor_heartbeats') AND c.contype = 'c' AND c.convalidated
                      AND c.conname = 'monitor_heartbeats_wake_lock_check'
                      AND position('''not_applicable''' IN pg_get_constraintdef(c.oid)) > 0)
;
