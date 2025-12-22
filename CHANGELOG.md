# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Hinzugefügt
- **Penalty Shootout Dialog** - Neuer Dialog für Elfmeterschießen bei Unentschieden in der Finalrunde
- **Tiebreaker Banner** - Anzeige bei Spielen die einen Sieger benötigen
- **Dashboard Echtzeit-Updates** - Dashboard aktualisiert sofort bei Turnier-Änderungen (via Storage Events)
- **Default Finals-Preset** - Hallenfußball verwendet jetzt standardmäßig 'top-4' Finals

### Geändert
- **Default Feldanzahl** - Hallenfußball verwendet jetzt standardmäßig 1 Feld (statt 2)

### Behoben
- **BUG-001: Match ID Synchronisierung** - Kritischer Bug behoben, bei dem alle Finalspiele dieselbe ID wie das erste Gruppenspiel erhielten
  - Root Cause: `scheduleMatches()` setzte kein `slot` auf ScheduledMatch-Objekten
  - Fix: `slot: match.slot ?? match.round - 1` in scheduleGenerator.ts hinzugefügt
  - Betroffene Datei: `src/lib/scheduleGenerator.ts`

- **BUG-002: CorrectionDialog zeigt Team-IDs statt Namen** - Im Korrektur-Dialog wurden interne Team-IDs angezeigt
  - Fix: `getTeamName()` Helper-Funktion hinzugefügt die IDs zu Namen auflöst
  - Betroffene Datei: `src/features/tournament-management/ScheduleTab.tsx`

- **BUG-003: Ergebnisse trotz Warnung änderbar** - Beendete Spiele konnten trotz Warnung direkt bearbeitet werden
  - Fix: MatchScoreCell zeigt jetzt immer read-only Mode für beendete Spiele
  - Korrektur nur noch über CorrectionDialog möglich
  - Betroffene Datei: `src/components/schedule/MatchScoreCell.tsx`

- **BUG-004: Dashboard aktualisiert nicht sofort** - Nach Metadaten-Änderungen wurde Dashboard nicht aktualisiert
  - Fix: Storage Event Listener und Custom Event Listener in useTournaments hinzugefügt
  - Custom Event `tournament-updated` wird bei Änderungen gefeuert
  - Betroffene Dateien: `src/hooks/useTournaments.ts`, `src/screens/TournamentManagementScreen.tsx`

---

## [1.0.0] - 2025-12-15

### Hinzugefügt
- Initiale Release
- Turnier-Erstellung mit Wizard
- Round-Robin und Gruppen+Finale Modi
- Fair Scheduler für optimale Spielplanung
- Live-Match-Management mit Timer
- Automatische Playoff-Auflösung
- PDF-Export
- Multi-Sport-Grundstruktur (Hallenfußball als erste Sportart)
