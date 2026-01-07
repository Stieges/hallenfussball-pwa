# Hallenfussball PWA - Vollständige Codebase-Analyse

## 1. Architektur-Übersicht

```mermaid
graph TD
    subgraph "Setup Phase"
        W[TournamentCreationScreen] --> WH[useTournamentWizard]
        WH --> TD[Tournament Draft]
    end
    
    subgraph "Generation Phase"
        TD --> SG[scheduleGenerator]
        SG --> SM[ScheduledMatch[]]
        SM --> TM[tournament.matches]
    end
    
    subgraph "Runtime Phase"
        TM --> SE[ScheduleEditor]
        TM --> LC[Live Cockpit]
        LC --> LMM[useLiveMatchManagement]
        LMM --> LS[localStorage]
    end
```

---

## 2. Datenfelder: Ursprung & Nutzung

### A. Tournament-Objekt (Hauptentität)

| Feld | Ursprung | Genutzt von |
|------|----------|-------------|
| `id` | `generateTournamentId()` in Wizard | Überall (Primary Key) |
| `title` | Wizard Step 3 | Dashboard, Header, Exports |
| `sport`, `sportId` | Wizard Step 1 | Terminology, Regelwerk |
| `tournamentType` | Wizard Step 1 | UI-Anpassungen (Bambini vs Classic) |
| `mode` | Wizard Step 2 | Spielablauf-Logik |
| `numberOfTeams` | Wizard Step 4 | Schedule-Generierung |
| `numberOfGroups` | Wizard Step 4 | Gruppen-Erstellung |
| `numberOfFields` | Wizard Step 4 | Feld-Verteilung |
| `groupPhaseGameDuration` | Wizard Step 2 | Timer, Schedule-Zeiten |
| `teams[]` | Wizard Step 5 | Überall |
| `matches[]` | scheduleGenerator | ScheduleEditor, Cockpit, Tabellen |
| `pointSystem` | Wizard Step 2 | Standings-Berechnung |
| `placementLogic[]` | Wizard Step 2 | Sortierung der Tabellen |
| `finals` / `finalsConfig` | Wizard Step 2 | Playoff-Generierung |
| `refereeConfig` | Wizard Step 6 | Schiri-Zuweisung |
| `groups[]` | Wizard Step 4 | Gruppen-Anzeige |
| `fields[]` | Wizard Step 4 | Feld-Anzeige |
| `status` | Wizard Publish | Dashboard-Filterung |

### B. Match-Objekt (Spiel-Entität)

| Feld | Ursprung | Genutzt von |
|------|----------|-------------|
| `id` | scheduleGenerator | Überall (Primary Key) |
| `round` | scheduleGenerator | Rundenanzeige |
| `field` | scheduleGenerator / ScheduleEditor | Feld-Anzeige |
| `slot` | scheduleGenerator | Zeitslot-Berechnung |
| `teamA`, `teamB` | scheduleGenerator | Spielpaarung |
| `scoreA`, `scoreB` | Live Cockpit | Ergebnis |
| `matchStatus` | Live Cockpit | Status (running/finished) |
| `scheduledTime` | scheduleGenerator / ScheduleEditor | Uhrzeitanzeige |
| `referee` | refereeAssigner | Schiri-Anzeige |
| `timerStartTime`, `timerPausedAt` | Live Cockpit | Timer-Persistenz |
| `penaltyScoreA/B` | Live Cockpit | Elfmeter-Ergebnis |
| `decidedBy` | Live Cockpit | Entscheidungsmodus |
| `skippedReason`, `skippedAt` | Live Cockpit | Übersprungene Spiele |

---

## 3. Logik-Module

### A. Tournament Wizard (`useTournamentWizard.ts` - 567 Zeilen)

**Zweck:** Schrittweise Erstellung eines neuen Turniers.

**Steps:**
1. Sport & Typ → `sport`, `tournamentType`
2. Modus & System → `mode`, `groupSystem`, Zeiten
3. Metadaten → `title`, `date`, `location`
4. Gruppen & Felder → `numberOfTeams`, `numberOfGroups`, `groups[]`
5. Teams → `teams[]`
6. Schiedsrichter → `refereeConfig`
7. Vorschau → Publizieren

**Wichtige Funktionen:**
- `createDraftTournament()` → Erstellt fertiges Tournament-Objekt
- `validateStep()` → Prüft Pflichtfelder pro Step

---

### B. Schedule Generator (`scheduleGenerator.ts` - 340 Zeilen)

**Zweck:** Erzeugt Spielplan aus Tournament-Definition.

**Ablauf:**
```
generateFullSchedule(tournament)
  ├── generateGroupStageMatches()    → Round-Robin-Paarungen
  ├── generateFinalMatches()         → Playoff-Spiele
  ├── scheduleMatches()              → Zeitslots zuweisen
  └── createPhases()                 → Phasen für UI
```

**Output:** `GeneratedSchedule` mit:
- `allMatches: ScheduledMatch[]`
- `phases: SchedulePhase[]`
- `standings: Standing[]`

---

### C. Live Match Management (`useLiveMatchManagement.ts` - 1390 Zeilen)

**Zweck:** Echtzeit-Verwaltung laufender Spiele.

**State:**
- `liveMatches: Map<string, LiveMatch>` (im Speicher)
- Persistenz via `localStorage` alle 5 Sekunden

**Wichtige Funktionen:**
- `handleStart(matchId)` → Startet Timer
- `handlePause/Resume(matchId)` → Pausiert Timer
- `handleGoal(matchId, team)` → Erhöht Score
- `handleFinish(matchId)` → Beendet Spiel, aktualisiert `tournament.matches`
- `handleRecordPenaltyResult()` → Elfmeterschießen

**Problem-Zone:** Direkte localStorage-Zugriffe, keine Repository-Abstraktion.

---

### D. Schedule Editor (`ScheduleEditor.tsx` + Hooks)

**Zweck:** Drag & Drop Bearbeitung des Spielplans.

**Datenfluss:**
1. Lädt `tournament.matches`
2. User verschiebt Spiel → `handleMoveMatch()`
3. Aktualisiert `scheduledTime` und `field`
4. Speichert via `handleTournamentUpdate()`

---

## 4. Datenspeicherung

### localStorage Keys

| Key | Inhalt | Zugriff |
|-----|--------|---------|
| `tournaments` | Array aller Turniere | api.ts, Hooks |
| `liveMatchData_{tournamentId}` | Live-State pro Turnier | useLiveMatchManagement |
| `theme` | Farbschema | useTheme |
| `userProfile` | Benutzerdaten | useUserProfile |

---

## 5. Identifizierte Problembereiche

### 1. **useLiveMatchManagement** (1390 Zeilen)
- Größter Hook der Codebasis
- Direkter localStorage-Zugriff
- Sollte in `MatchExecutionService` migriert werden

### 2. **Doppelte Schedule-Logik**
- `scheduleGenerator.ts` erstellt Schedule
- `useTournamentManager` lädt/speichert
- `useScheduleEditor` hat eigene Edit-Logik
- → Sollte vereinheitlicht werden

### 3. **Fehlende Validierung**
- Keine Zod-Schemas am Storage-Boundary
- Korrupte Daten können Crashes verursachen

### 4. **Generator-Dateien verstreut**
- `src/lib/scheduleGenerator.ts`
- `src/utils/fairScheduler.ts`
- `src/utils/playoffScheduler.ts`
- → Sollten in `src/core/generators/` konsolidiert werden

---

## 6. Empfohlene Migrationsreihenfolge

| Priorität | Bereich | Aufwand |
|-----------|---------|---------|
| 1 | `useLiveMatchManagement` → Service | Hoch |
| 2 | Alle Generators → `src/core/generators/` | Mittel |
| 3 | Zod-Validierung am Storage-Layer | Mittel |
| 4 | `useScheduleEditor` → `ScheduleService` | Niedrig |
