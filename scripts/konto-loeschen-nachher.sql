-- konto-loeschen-nachher.sql -- NUR LESEND. Prueft NACH dem Einspielen von 20261128_001_konto_loeschen.sql, ob die fuenf Regeln und die
-- Vorpruefung da sind, und zaehlt/summiert wie konto-loeschen-vorher.sql. Eine Zeile Ausgabe; "urteil" muss OK sein.
-- Aufruf (Betreiber): im SQL-Editor als Ganzes ausfuehren. "pruefsummen" muss mit der Ausgabe von konto-loeschen-vorher.sql gleich sein
-- (die Migration aendert und loescht keine Zeile); "urteil" muss OK sein. Der Fremdschluessel invited_by darf nicht mehr vorkommen.
-- GRENZE: Die Pruefsummen sind nur aussagekraeftig, wenn zwischen "vorher" und "nachher" niemand schreibt (Cockpit, Testturnier, Monitor-Zaehler).
-- Beide Abfragen und die Migration deshalb direkt hintereinander ausfuehren, wenn kein Turnier laeuft. Weichen die Summen ab, ohne dass sich
-- "zeilen_je_spalte" aendert: pruefen, in welcher Tabelle (Summen stehen je Tabelle) zwischendurch geschrieben wurde, und beide Abfragen
-- wiederholen; die Migration selbst loescht und aendert keine Zeile (im Wegwerf-Container belegt).
-- Rein ASCII.
SELECT
  CASE WHEN (SELECT string_agg(c.conname || '=' || c.confdeltype::text, ' ' ORDER BY c.conname)
               FROM pg_constraint c
              WHERE c.conname IN ('matches_last_modified_by_fkey', 'tournaments_last_modified_by_fkey', 'match_corrections_corrected_by_fkey',
                                  'tournament_collaborators_invited_by_fkey', 'tournaments_owner_id_fkey'))
            = 'match_corrections_corrected_by_fkey=n matches_last_modified_by_fkey=n tournaments_last_modified_by_fkey=n tournaments_owner_id_fkey=r'
        AND to_regprocedure('public.account_deletion_check(uuid)') IS NOT NULL
        AND NOT has_function_privilege('anon', 'public.account_deletion_check(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.account_deletion_check(uuid)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.account_deletion_check(uuid)', 'EXECUTE')
       THEN 'OK' ELSE 'ABWEICHUNG' END AS urteil,
  (SELECT string_agg(c.conrelid::regclass::text || '.' || c.conname || '=' || CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'c' THEN 'CASCADE'
                     WHEN 'n' THEN 'SET NULL' WHEN 'r' THEN 'RESTRICT' ELSE c.confdeltype::text END, '; ' ORDER BY c.conname)
     FROM pg_constraint c
    WHERE c.conname IN ('matches_last_modified_by_fkey', 'tournaments_last_modified_by_fkey', 'match_corrections_corrected_by_fkey',
                        'tournament_collaborators_invited_by_fkey', 'tournaments_owner_id_fkey')) AS regeln_ist,
  (to_regprocedure('public.account_deletion_check(uuid)') IS NOT NULL) AS vorpruefung_vorhanden,
  jsonb_build_object(
    'turniere', (SELECT count(*) FROM public.tournaments),
    'turniere_veroeffentlicht', (SELECT count(*) FROM public.tournaments WHERE is_public),
    'eigentuemer_konten', (SELECT count(DISTINCT owner_id) FROM public.tournaments),
    'matches_last_modified_by_gesetzt', (SELECT count(*) FROM public.matches WHERE last_modified_by IS NOT NULL),
    'tournaments_last_modified_by_gesetzt', (SELECT count(*) FROM public.tournaments WHERE last_modified_by IS NOT NULL),
    'match_corrections_corrected_by_gesetzt', (SELECT count(*) FROM public.match_corrections WHERE corrected_by IS NOT NULL),
    'collaborators_invited_by_gesetzt', (SELECT count(*) FROM public.tournament_collaborators WHERE invited_by IS NOT NULL)) AS zeilen_je_spalte,
  jsonb_build_object(
    'tournaments', (SELECT count(*) || '/' || coalesce(md5(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text)), '-') FROM public.tournaments x),
    'teams', (SELECT count(*) || '/' || coalesce(md5(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text)), '-') FROM public.teams x),
    'matches', (SELECT count(*) || '/' || coalesce(md5(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text)), '-') FROM public.matches x),
    'match_events', (SELECT count(*) || '/' || coalesce(md5(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text)), '-') FROM public.match_events x),
    'match_event_authors', (SELECT count(*) || '/' || coalesce(md5(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text)), '-') FROM public.match_event_authors x),
    'tournament_collaborators', (SELECT count(*) || '/' || coalesce(md5(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text)), '-') FROM public.tournament_collaborators x)) AS pruefsummen;
