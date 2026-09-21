# Migrationen: Baseline und Schema-Verwaltung

## Was ist die Baseline?

Die Datei `00000000000000_baseline_live_schema.sql` stellt den kompletten aktuellen Schemastand dar. Sie wurde am 21. September 2026 erzeugt mit dem Befehl `supabase db dump --schema public --linked`. Die Rohdatei hatte 2270 Zeilen; 182 Zeilen wurden entfernt, weil sie Plattform-Boilerplate sind — 127 GRANT-Statements, 42 ALTER OWNER-Zeilen, 12 ALTER DEFAULT PRIVILEGES-Zeilen und 1 REVOKE — die jede Supabase-Instanz bei der Provisionierung selbst erzeugt. Das Ergebnis hat 1755 Zeilen und bildet den Datenbank-Zustand nach den Migrationen vom 18. und 21. September 2026 ab.

## Der Beweis der Korrektheit

Die Baseline wurde in einen leeren Container des Images `supabase/postgres:17.6.1.063` eingespielt — und führte fehlerfrei aus. Das wiederhergestellte Schema stimmt mit der Live-Datenbank exakt überein, gemessen in sieben Katalog-Dimensionen: 13 Tabellen, 233 Spalten, 44 Row-Level-Security-Policies, 28 Funktionen, 23 Trigger, 57 Indizes, 13 Tabellen mit aktiviertem RLS. Zusätzlich wurden die Definitionen aller Objekte objektweise verglichen — Constraints, Indizes, Funktionsbodys, Trigger, Policies — kein Unterschied gefunden.

## Wichtige Einschränkung: Supabase-abhängig

Die Baseline enthält 9 Fremdschlüssel auf die Tabelle `auth.users` und 67 Aufrufe von Supabase-Funktionen (`auth.uid()`, `auth.email()`) in RLS-Policies. Sie ist deshalb nur auf einer Supabase-Instanz anwendbar, nicht auf nacktem PostgreSQL. Das ist kein Fehler, sondern die strukturelle Natur dieses Projekts.

## Die Bestandsdateien sind nicht mehr von Null replayfähig

Die 23 älteren Migrationsdateien von Januar bis September 2026 bleiben eingecheckt. Sie sind das Änderungsprotokoll und erklären, warum die Datenbank so aussieht. Aber wenn man diese Migrationen der Reihe nach gegen eine Datenbank einspielt, die mit der Baseline initialisiert wurde, scheitern drei Dateien mit Kollisionsfehler: `20260121_005_anonymous_limit.sql` versucht `CREATE POLICY "tournaments_insert_v3"` zu erstellen, doch die Policy existiert bereits; `20260128_002_consolidate_rls_v3.sql` versucht `CREATE POLICY "tournaments_select_v3"`, die ebenfalls bereits vorhanden ist; `20260129_001_monitor_heartbeats.sql` versucht `CREATE POLICY "owner_select_heartbeats"`, die auch schon existiert. Alle drei Fehler folgen dem gleichen Muster: ein nacktes `CREATE POLICY` ohne vorangehendes `DROP POLICY IF EXISTS`, denn PostgreSQL kennt kein `CREATE POLICY IF NOT EXISTS`. Die Baseline ist der Endzustand und enthält bereits die finalen Policy-Namen — wenn ältere Migrationen versuchen, diese Policies zu erstellen, existieren sie längst. Das bedeutet: Die Bestandsdateien dokumentieren die Entwicklung, sind aber nicht mehr zur Neurekonstruktion der Datenbank brauchbar. Sie sind Archiv, nicht Replay-Skripte.

## Namensraum-Konflikt: kein `db push` in diesem Projekt

Die Tabelle `supabase_migrations.schema_migrations`, die Supabase intern pflegt, und die Dateinamen in diesem Verzeichnis haben keinen gemeinsamen Namensraum. Das Projekt wurde von Januar bis Juni 2026 über den Supabase-Dashboard-SQL-Editor verwaltet — mehrere Migrationsdateien dokumentieren das explizit mit „Run this in your Supabase SQL Editor" im Kopf. Ab Juli 2026 wurde die Verwaltung auf MCP-basierte Einspielungen umgestellt. Deshalb nutzt das Projekt `db push` nicht. Ein `db push` müsste 22 unbekannte Versionen auf eine Datenbank anwenden, die ihre Wirkung längst hat. Das führt zu Konflikten und ist mit dieser Hybrid-Verwaltungsstruktur nicht praktikabel.

## Regel für neue Migrationen

Neue Migrationen müssen nach einem festen Pattern erfolgen: Sie werden eingecheckt — in `supabase/migrations/` — und über `apply_migration` (Supabase MCP) in die Live-Datenbank eingespielt. Beides zusammen, nicht eines von beiden. Das stellt sicher, dass eine neue Migration im Repo registriert ist und ihre Wirkung auf der Live-Datenbank messbar ist.
