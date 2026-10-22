-- supabase/migrations/20261110_007_ci_schema_reader_grants.sql
-- Leserecht der Drift-Check-Rolle ci_schema_reader auf public.field_control und public.match_corrections (Werkzeugkette,
-- Kontext plattform; Daniel-Freigabe 21.10.: "GRANT SELECT ON public.field_control TO ci_schema_reader" ins naechste
-- DB-Fenster; match_corrections = Befund C-GRANTS-NUR-LIVE, Nachtrag 22.10.).
--
-- Ursache: 20261110_003_field_control.sql (A-34, live seit dem DB-Fenster 20.10.) legt public.field_control an,
-- vergibt aber kein SELECT an ci_schema_reader. scripts/db-drift-check.sh zieht das Live-Schema per
-- `pg_dump --schema=public --schema=match_engine --schema-only` als diese Rolle; pg_dump sperrt jede Tabelle mit
-- LOCK TABLE ... IN ACCESS SHARE MODE, das braucht SELECT. Seit dem Fenster bricht der Job schema-drift-check mit
-- "permission denied for table field_control" ab. Bewusst kein ALTER DEFAULT PRIVILEGES (Datenbank-Programm
-- 21.09.): jede neue Tabelle bekommt ihren GRANT ausdruecklich, wie match_event_authors (20260928_001, I1).
--
-- Vollstaendig geprueft (Wegwerf-Container, Baseline + Live-Rechte der Rolle nachgebildet + alle Migrationen auf
-- origin/main): field_control ist die EINZIGE Tabelle in public/match_engine ohne SELECT fuer ci_schema_reader. Sequenzen und Funktionen braucht
-- pg_dump --schema-only (PG 17) nicht lesbar; Views gibt es in beiden Schemata keine.
--
-- Inhalt (1): GRANT SELECT ON public.field_control TO ci_schema_reader. Keine Policy: RLS bleibt an, fuer
-- ci_schema_reader greift keine Policy, sie sieht weiterhin 0 Zeilen -- der GRANT sichert nur den Schema-Dump.
-- anon/authenticated bleiben ohne Tabellenrecht (Assertion field-control-no-client-access unveraendert).
--
-- Inhalt (2), Befund C-GRANTS-NUR-LIVE: GRANT SELECT ON public.match_corrections TO ci_schema_reader. Dieses Recht
-- hat das Datenbank-Programm (21.09.) LIVE vergeben, es steht aber in keiner Migration (die Baseline traegt bewusst
-- keine GRANT-Zeilen). Ein aus dem Repo aufgebauter Stand weicht deshalb ab: pg_dump --schema-only als Leserolle
-- scheitert dort zuerst mit "permission denied for table match_corrections". Live ist diese Zeile ein No-op (Recht
-- schon vorhanden); sie holt den Live-Stand ins Repo. Achtung, anders als (1): die Policy match_corrections_select_v2
-- (Baseline, FOR SELECT ohne TO = PUBLIC, USING is_public = true OR auth.uid() = owner_id) gilt auch fuer
-- ci_schema_reader -- die Rolle sieht die oeffentlichen Korrekturzeilen, wie live heute schon und wie anon.
-- Die uebrigen Baseline-Tabellen fehlen der Rolle im Repo-Stand ebenso (Liste in ci-grants-sql-freigabe.md); sie
-- sind hier bewusst NICHT ergaenzt (eigene Freigabe).
--
-- Fail-fast ohne Aenderung, wenn die Rolle oder eine der Tabellen fehlt. Idempotent (GRANT ist wiederholbar).
-- lock_timeout 5 s wie alle Fenster-Dateien (GRANT nimmt kurz eine Sperre auf den Katalogeintrag); bei 55P03
-- genau einmal wiederholen.
--
-- Haengt nur an 20261110_003 (Tabelle) und 20260924_002 (Rolle); unabhaengig von 20261110_005/_006 und
-- 20261113_101 (andere Branches, eigene Auflagen fuer deren neue Tabellen).
--
-- RUECKWEG (Anhang B von ci-grants-sql-freigabe.md): in EINEM Block
--   REVOKE SELECT ON public.field_control FROM ci_schema_reader;
-- danach Assertion positive-ci-schema-reader-select-field-control + PRIVILEGE_ASSERTION_NAMES +
-- pending_assertions_for zurueck. Schema und Rechte sind danach identisch zum Stand vorher (im Container belegt).
-- match_corrections wird live NICHT entzogen (das Recht bestand live schon vor _007; ein REVOKE wuerde den
-- Drift-Check brechen). Nur im Repo die Zeile positive-ci-schema-reader-select-match-corrections mit zuruecknehmen.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261110_007_ci_schema_reader_grants: Rolle ci_schema_reader fehlt -- zuerst 20260924_002 einspielen';
  END IF;
  IF to_regclass('public.field_control') IS NULL THEN
    RAISE EXCEPTION '20261110_007_ci_schema_reader_grants: Tabelle public.field_control fehlt -- zuerst 20261110_003 einspielen';
  END IF;
  IF to_regclass('public.match_corrections') IS NULL THEN
    RAISE EXCEPTION '20261110_007_ci_schema_reader_grants: Tabelle public.match_corrections fehlt -- zuerst die Baseline einspielen';
  END IF;
END
$$;

GRANT SELECT ON TABLE public.field_control TO ci_schema_reader;
GRANT SELECT ON TABLE public.match_corrections TO ci_schema_reader;

COMMIT;
