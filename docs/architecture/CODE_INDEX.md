# Hallenfußball PWA - Code Index

Vollständige Schnellreferenz für die Codebase mit allen Features und deren Implementierung.

## 📑 Inhaltsverzeichnis

1. [⚡ Performance Optimierungen](#-performance-optimierungen)
2. [🏗️ Architektur-Übersicht](#️-architektur-übersicht)
3. [🔄 Variable Datenfelder](#-variable-datenfelder-nie-hart-codieren)
4. [🪝 Custom Hooks](#-custom-hooks)
5. [🌍 Context & State Management](#-context--state-management)
6. [📁 Datei-Struktur & Verantwortlichkeiten](#-datei-struktur--verantwortlichkeiten)
7. [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
8. [📊 Wichtige Enums & Constants](#-wichtige-enums--constants)
9. [📝 Implementierte Features](#-implementierte-features)

---

## ⚡ Performance Optimierungen

### Lazy Loading (Screens)

**Datei**: `/src/App.tsx` (Zeilen 9-55)

Alle Haupt-Screens werden mit `React.lazy()` geladen für bessere initiale Ladezeit:

```typescript
const DashboardScreen = lazy(() =>
  import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen }))
);
const TournamentCreationScreen = lazy(() =>
  import('./screens/TournamentCreationScreen').then(m => ({ default: m.TournamentCreationScreen }))
);
const TournamentManagementScreen = lazy(() =>
  import('./screens/TournamentManagementScreen').then(m => ({ default: m.TournamentManagementScreen }))
);
const PublicTournamentViewScreen = lazy(() =>
  import('./screens/PublicTournamentViewScreen').then(m => ({ default: m.PublicTournamentViewScreen }))
);
```

**ScreenLoader Fallback** (Zeilen 24-55):
- Animierter Spinner während des Ladens
- Konsistentes Design mit Theme-Farben

**Build-Output (Code Splitting aktiv)**:
| Chunk | Größe |
|-------|-------|
| DashboardScreen | 30.89 kB |
| TournamentCreationScreen | 39.52 kB |
| TournamentManagementScreen | 149.02 kB |
| PublicTournamentViewScreen | 3.11 kB |

---

## 🏗️ Architektur-Übersicht

### Core-Flow: Turniererstellung → Spielplan → PDF Export
1. **Tournament Creation** → Step1-4 → Preview → Publish
2. **Schedule Generation** → scheduleGenerator.ts → playoffScheduler → fairScheduler
3. **Display** → ScheduleDisplay → GroupStageSchedule / FinalStageSchedule
4. **PDF Export** → pdfExporter.ts → HTML-basiertes Layout → jsPDF + autoTable

### Backend-Architektur (Local-First + Supabase)

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Components                         │
│      (Dashboard, Wizard, Management, Live-Cockpit)              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ useRepositories()
┌─────────────────────────────▼───────────────────────────────────┐
│                      RepositoryContext                           │
│  Entscheidet basierend auf Auth-Status welches Repo zu nutzen   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │ Authenticated                              │ Guest / Offline
        ▼                                            ▼
┌───────────────────┐                    ┌───────────────────┐
│  OfflineRepository │                    │LocalStorageRepository│
│  (Hybrid)          │                    │  (Pure Local)       │
└────────┬──────────┘                    └───────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────────────┐ ┌────────────────┐
│Local   │ │ Supabase       │ │ MutationQueue  │
│Storage │ │ Repository     │ │ (Offline Sync) │
│(Cache) │ │ (Cloud Truth)  │ │                │
└────────┘ └────────────────┘ └────────────────┘
```

**Wichtige Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/core/contexts/RepositoryContext.tsx` | Wählt Repository basierend auf Auth |
| `src/core/repositories/OfflineRepository.ts` | Local-First mit Cloud-Sync |
| `src/core/repositories/SupabaseRepository.ts` | Supabase-Implementierung |
| `src/core/services/MutationQueue.ts` | Queue für Offline-Änderungen |

**Local-First Strategie:**
```typescript
// OfflineRepository.get() - Schnelle lokale Antwort
async get(id: string): Promise<Tournament | null> {
    // 1. IMMER erst lokal laden (instant)
    const localData = await this.localRepo.get(id);
    if (localData) {
        // Background-Sync (non-blocking)
        void this.refreshFromCloudInBackground(id);
        return localData;
    }

    // 2. Nur wenn lokal nicht vorhanden → Cloud
    return await this.supabaseRepo.get(id);
}
```

---

## 🔄 Variable Datenfelder (NIE hart codieren!)

**WICHTIG:** Diese Felder müssen IMMER aus Backend/Props/State kommen, niemals hart codiert!

### Turnier-Metadaten
- `tournament.title` - Turniername (z.B. "U13 Hallenturnier 2025")
- `tournament.ageClass` - Altersklasse (z.B. "U13", "Herren", "E-Jugend")
- `tournament.date` - Datum (z.B. "2025-02-15")
- `tournament.timeSlot` / `tournament.startTime` - Startzeit (z.B. "14:00")
- `tournament.location` - Ort/Halle (z.B. "Sporthalle Waging")
- `tournament.id` - Eindeutige Turnier-ID

### Organisator/Veranstalter
- `organizerName` - Name des Veranstalters (z.B. "SV Waging", "Wieninger-Libella")
- `hallName` - Hallenname (z.B. "Dreifachturnhalle Nord")

### Teams
- `team.id` - Eindeutige Team-ID
- `team.name` - Teamname (z.B. "SV Waging", "TSV Traunstein")
- `team.group` - Gruppenzuordnung (z.B. "A", "B", "C")

### Spiele
- `match.id` - Eindeutige Spiel-ID
- `match.matchNumber` - Spielnummer (dynamisch generiert)
- `match.homeTeam` / `match.awayTeam` - Teamnamen
- `match.time` / `match.scheduledKickoff` - Anstoßzeit
- `match.field` - Feldnummer (1, 2, 3, ...)
- `match.referee` - Schiedsrichter-Nummer oder Name
- `match.phase` / `match.phaseLabel` - Spielphase (z.B. "Vorrunde Gruppe A", "Halbfinale")
- `match.homeScore` / `match.awayScore` - Spielstand (Live-Daten)

### Live-Match-Daten
- `liveMatch.status` - Spielstatus ('NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED')
- `liveMatch.elapsedSeconds` - Verstrichene Spielzeit
- `liveMatch.events` - Ereignisliste (Tore, Statusänderungen)

### Schiedsrichter
- `refereeConfig.numberOfReferees` - Anzahl Schiedsrichter (z.B. 2, 3)
- `refereeConfig.refereeNames` - Namen der Schiedsrichter (z.B. {1: "Max Mustermann"})
- `refereeName` - Schiedsrichter-Name für ein Spiel

### Felder/Plätze
- `numberOfFields` - Anzahl Spielfelder
- `fieldId` - Feld-ID (z.B. "field-1", "field-2")
- `fieldName` - Feldname (z.B. "Feld 1", "Hauptfeld")

### Zeitdaten
- `tournament.groupPhaseGameDuration` - Spieldauer Gruppenphase (Minuten)
- `tournament.finalRoundGameDuration` - Spieldauer Finalrunde (Minuten)
- `tournament.groupPhaseBreakDuration` - Pause zwischen Spielen
- `schedule.startTime` - Berechnete Turnier-Startzeit
- `schedule.endTime` - Berechnete Turnier-Endzeit

### Tabellen/Statistiken
- `standing.played` - Anzahl gespielte Spiele
- `standing.won` / `standing.drawn` / `standing.lost` - Spielergebnisse
- `standing.goalsFor` / `standing.goalsAgainst` - Tore
- `standing.goalDifference` - Tordifferenz
- `standing.points` - Punkte

### Konfiguration
- `finalsConfig.preset` - Finalrunden-Preset ('none', 'final-only', 'top-4', etc.)
- `refereeConfig.mode` - Schiedsrichter-Modus ('none', 'organizer', 'teams')
- `pointSystem.win` / `pointSystem.draw` / `pointSystem.loss` - Punktevergabe

**Wo kommen diese Daten her?**
1. **Turniererstellung** → User-Input (Step 1-4)
2. **Schedule Generation** → Berechnete Daten (scheduleGenerator.ts)
3. **Live-Tracking** → Backend/WebSocket während des Turniers
4. **Container-Komponenten** → Props von Parent/State-Management

**Beispiel korrekte Verwendung:**
```typescript
// ✅ RICHTIG - Aus Props/State
<MatchCockpit
  tournamentName={tournament.title}
  fieldName={`Feld ${fieldNumber}`}
  currentMatch={liveMatch}
  onGoal={handleGoal}
/>

// ❌ FALSCH - Hart codiert
<MatchCockpit
  tournamentName="Wieninger-Libella 2025"  // ← NIEMALS!
  fieldName="Feld 1"                      // ← NIEMALS!
/>
```

---

## 🪝 Custom Hooks

### Zentrale Exports: `/src/hooks/index.ts`

Alle Custom Hooks werden zentral exportiert für einfachen Import:

```typescript
import { useDebounce, useClickOutside, usePrevious } from '../hooks';
```

### `/src/hooks/useDebounce.ts` - Input Debouncing

**Zweck**: Verzögert Wertänderungen für Performance-Optimierung (z.B. Sucheingaben)

```typescript
// Hook: Debounced Value
const debouncedSearch = useDebounce(searchTerm, 300);

// Hook: Debounced Callback
const debouncedSave = useDebouncedCallback((value) => save(value), 500);
```

**Exports**:
- `useDebounce<T>(value, delay)` - Gibt verzögerten Wert zurück
- `useDebouncedCallback(callback, delay)` - Gibt verzögerte Funktion zurück

### `/src/hooks/useClickOutside.ts` - Außenklick-Erkennung

**Zweck**: Schließt Modals/Dropdowns bei Klick außerhalb

```typescript
const ref = useRef<HTMLDivElement>(null);
useClickOutside(ref, () => setIsOpen(false));
```

**Exports**:
- `useClickOutside(ref, handler)` - Einzelne Ref
- `useClickOutsideMultiple(refs, handler)` - Mehrere Refs

### `/src/hooks/usePrevious.ts` - Vorherigen Wert tracken

**Zweck**: Zugriff auf vorherigen State/Props-Wert

```typescript
const prevCount = usePrevious(count);
// Bei count=5 nach count=3: prevCount === 3
```

**Exports**:
- `usePrevious<T>(value)` - Gibt vorherigen Wert zurück
- `usePreviousDistinct<T>(value, compare?)` - Nur bei tatsächlicher Änderung

---

## 🏗️ Core Services & Repositories

### `/src/core/` - Business Logic Layer

Die gesamte Business-Logik ist in `src/core/` gekapselt und framework-agnostisch (kein React).

```
src/core/
├── contexts/           # React Contexts (Ausnahme)
│   └── RepositoryContext.tsx
├── models/             # Domain Types + Zod Schemas
│   ├── types.ts
│   └── schemas/
├── repositories/       # Data Access Layer
│   ├── ITournamentRepository.ts      # Interface
│   ├── LocalStorageRepository.ts     # Local-only
│   ├── SupabaseRepository.ts         # Cloud
│   ├── OfflineRepository.ts          # Hybrid (Local-First)
│   └── LocalStorageLiveMatchRepository.ts
├── services/           # Business Logic
│   ├── TournamentService.ts
│   ├── ScheduleService.ts
│   ├── MatchExecutionService.ts
│   ├── TournamentCreationService.ts
│   └── MutationQueue.ts
├── generators/         # Schedule/Playoff Generation
│   └── index.ts
├── storage/            # Storage Abstraction
│   ├── IndexedDBAdapter.ts
│   ├── LocalStorageAdapter.ts
│   └── StorageFactory.ts
└── utils/              # Core Utilities
    └── SingleFlight.ts
```

### Key Services

| Service | Datei | Zweck |
|---------|-------|-------|
| `TournamentService` | `services/TournamentService.ts` | Tournament CRUD |
| `ScheduleService` | `services/ScheduleService.ts` | Match Updates, Score Changes |
| `MatchExecutionService` | `services/MatchExecutionService.ts` | Live-Spiel-Logik (Start/Pause/Goal/Finish) |
| `TournamentCreationService` | `services/TournamentCreationService.ts` | Wizard-Validierung, Publish |
| `MutationQueue` | `services/MutationQueue.ts` | Offline-Änderungen queuen |

### Key Repositories

| Repository | Datei | Wann verwendet |
|------------|-------|----------------|
| `LocalStorageRepository` | `repositories/LocalStorageRepository.ts` | Guest-Mode, Fallback |
| `SupabaseRepository` | `repositories/SupabaseRepository.ts` | Cloud-Operationen |
| `OfflineRepository` | `repositories/OfflineRepository.ts` | Authenticated Users (Hybrid) |

---

## 🌍 Context & State Management

### `/src/core/contexts/RepositoryContext.tsx` - Repository Provider (NEU)

**Zweck**: Bereitstellung des korrekten Repositories basierend auf Auth-Status

```typescript
interface RepositoryContextValue {
  tournamentRepository: ITournamentRepository;
  liveMatchRepository: ILiveMatchRepository;
  isRealtimeEnabled: boolean;
}
```

**Verwendung:**
```typescript
const { tournamentRepository, isRealtimeEnabled } = useRepositories();
```

**Logik:**
- **Authenticated (Supabase)** → `OfflineRepository` (Local-First mit Cloud-Sync)
- **Guest/Offline** → `LocalStorageRepository` (Rein lokal)

---

### `/src/contexts/TournamentContext.tsx` - Globaler Tournament State

**Zweck**: Zentrales State Management für Tournament-Daten mit Reducer-Pattern

**State Interface**:
```typescript
interface TournamentState {
  tournament: Tournament | null;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
  lastSaved: string | null;
}
```

**Verfügbare Actions**:
| Action | Beschreibung |
|--------|--------------|
| `LOAD_TOURNAMENT` | Lädt Tournament in State |
| `UPDATE_TOURNAMENT` | Aktualisiert Tournament-Metadaten |
| `UPDATE_MATCH` | Aktualisiert einzelnes Match |
| `UPDATE_SCORE` | Setzt Spielergebnis |
| `UPDATE_TEAM` | Aktualisiert Team-Daten |
| `ADD_TEAM` / `REMOVE_TEAM` | Team-Verwaltung |
| `MARK_DIRTY` / `MARK_SAVED` | Speicherstatus |

**Haupt-Hook**: `useTournament()`
```typescript
const {
  tournament,
  updateScore,
  updateMatch,
  save,
  isDirty
} = useTournament();
```

**Selector Hooks** (Performance-optimiert):
- `useTournamentMeta()` - Nur Metadaten (verhindert Re-Renders bei Match-Updates)
- `useMatch(matchId)` - Einzelnes Match mit Update-Funktion
- `useTeams()` - Teams mit CRUD-Funktionen

**Verwendung**:
```typescript
// Provider in App.tsx
<TournamentProvider initialTournament={tournament}>
  <TournamentManagementScreen />
</TournamentProvider>

// Consumer in beliebiger Komponente
const { tournament, updateScore } = useTournament();
```

---

## 📁 Datei-Struktur & Verantwortlichkeiten

### `/src/components/ui/NumberStepper.tsx` - Mobile-freundliche Zahleneingabe
**Zweck**: Wiederverwendbare Komponente für mobile-optimierte Zahleneingabe

**Modi:**
- `stepper` (Default): ± Buttons mit großen Touch-Targets (44x44px)
- `slider`: Range-Slider für schnelle Auswahl
- `input`: Direkte Tastatur-Eingabe für Power-User

**Props:**
- `value: number` - Aktueller Wert
- `onChange: (value: number) => void` - Änderungs-Callback
- `min?: number` - Minimalwert (default: 0)
- `max?: number` - Maximalwert (default: 100)
- `step?: number` - Schrittgröße (default: 1)
- `label?: string` - Label-Text
- `suffix?: string` - Suffix (z.B. "Min", "Teams")
- `mode?: 'stepper' | 'slider' | 'input'` - Eingabe-Modus
- `disabled?: boolean` - Disabled-Status

**Features:**
- WCAG 2.1 Level AA konforme Touch-Targets (min 44x44px)
- Automatische Min/Max-Validierung
- Visuelles Feedback (hover, active states)
- Responsive Design mit Media Queries
- Theme-System Integration

**Verwendung:**
```typescript
<NumberStepper
  value={numberOfTeams}
  onChange={setNumberOfTeams}
  min={2}
  max={32}
  mode="stepper"
  label="Anzahl Teams"
/>

<NumberStepper
  value={gameDuration}
  onChange={setGameDuration}
  min={5}
  max={20}
  mode="slider"
  suffix=" Min"
  label="Spieldauer"
/>
```

**Exportiert in:** `/src/components/ui/index.ts`

---

### `/src/types/tournament.ts` - Zentrale Type Definitions
**Wichtige Types:**
- `FinalsPreset`: 'none' | 'final-only' | 'top-4' | 'top-8' | 'top-16' | 'all-places'
- `FinalsConfig`: { preset, parallelSemifinals, parallelQuarterfinals, parallelRoundOf16 }
- `RefereeMode`: 'none' | 'organizer' | 'teams'
- `FinalsRefereeMode`: 'none' | 'neutralTeams' | 'nonParticipatingTeams'
- `RefereeConfig`: { mode, numberOfReferees?, maxConsecutiveMatches?, refereeNames?, finalsRefereeMode?, manualAssignments? }
- `Tournament`: Haupt-Datenstruktur
- `Match`: Spiel-Objekt (teamA, teamB, isFinal, finalType, label, slot, field, referee?)
- `ScheduledMatch`: Spiel mit Zeit (matchNumber, time, homeTeam, awayTeam, phase, referee?, startTime, endTime)
- `Standing`: Tabelleneintrag (team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points)
- `PlacementCriterion`: Platzierungslogik (id: 'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'wins' | 'directComparison', enabled)

**Wichtige Felder:**
- `tournament.finalsConfig` - Neue preset-basierte Finalrunden-Konfiguration
- `tournament.refereeConfig` - Schiedsrichter-Konfiguration (Modus, Anzahl, Einstellungen)
- `tournament.fieldAssignments` - Manuelle Feld-Zuweisungen (matchId → fieldNumber)
- `tournament.placementLogic` - Platzierungskriterien mit Reihenfolge
- `match.slot` - Zeitslot vom Fair Scheduler
- `match.referee` - Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.)
- `match.field` - Feld-Nummer (1, 2, 3, ...)
- `match.isFinal` - Boolean ob Finalrunden-Spiel

---

### 📦 Schedule Generator Module (Modulares System)

Das Schedule-Generation-System wurde in 4 spezialisierte Module aufgeteilt für bessere Wartbarkeit:

| Modul | Zweck | Exports |
|-------|-------|---------|
| `scheduleTypes.ts` | Type Definitions | `ScheduledMatch`, `SchedulePhase`, `GeneratedSchedule` |
| `scheduleHelpers.ts` | Utility-Funktionen | `parseStartTime`, `formatTime`, `scheduleMatches`, `translatePlaceholder` |
| `scheduleRenderer.ts` | Export & Print | `formatScheduleForPrint`, `exportScheduleAsCSV`, `calculateScheduleStats` |
| `scheduleGenerator.ts` | Haupt-Orchestration | `generateFullSchedule` (re-exports alle Types) |

---

### `/src/lib/scheduleTypes.ts` - Type Definitions
**Exports:**
- `ScheduledMatch` - Komplettes Match mit Zeit, Teams, Referee
- `SchedulePhase` - Gruppenphase/Finalrunde mit Matches
- `GeneratedSchedule` - Komplettes Turnier-Schedule
- `SchedulePhaseType` - Union: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final'

---

### `/src/lib/scheduleHelpers.ts` - Utility-Funktionen

**Time Utilities:**
- `parseStartTime(date, timeSlot)` - Parst ISO/German-Datum + Uhrzeit
- `addMinutes(date, minutes)` - Addiert Minuten zu Date
- `formatTime(date)` - Formatiert Date zu "HH:MM"
- `calculateTotalMatchDuration(gameDuration, periods, halftimeBreak)` - Berechnet Gesamt-Matchdauer

**Match Scheduling:**
- `scheduleMatches(options)` - Scheduliert Matches mit Zeiten
  - Sortiert nach Slot/Round
  - Gruppiert Matches nach Slots
  - Berechnet Start/End-Zeiten

**Team Name Resolution:**
- `resolveTeamName(teamId, teamMap, locale, groups?)` - Löst Team-Namen auf
- `translatePlaceholder(placeholder, locale, groups?)` - Übersetzt Playoff-Platzhalter
  - Unterstützt Custom-Gruppennamen aus `groups`
  - **Deutsche Übersetzungen**: `semi1-winner` → "Sieger HF 1", `qf1-winner` → "Sieger VF 1"

---

### `/src/lib/scheduleRenderer.ts` - Export & Print

**Print Formatting:**
- `formatScheduleForPrint(schedule)` - Generiert HTML für Druckansicht
  - Returns: `{ header, matchList, standingsTable }`

**CSV Export:**
- `exportScheduleAsCSV(schedule)` - Exportiert als CSV-String
  - Format: Nr, Zeit, Feld, Heim, Gast, Gruppe, Phase, Ergebnis

**Statistics:**
- `calculateScheduleStats(schedule)` - Berechnet Schedule-Statistiken
  - Returns: `ScheduleStats { totalMatches, groupStageMatches, finalMatches, averageMatchDuration, matchesPerField }`

---

### `/src/lib/scheduleGenerator.ts` - Haupt-Orchestration
**Zweck**: Kombiniert Gruppenphase + Playoffs zu komplettem Zeitplan

**Hauptfunktion:**
- `generateFullSchedule(tournament, locale?)` - **Entry Point**
  - Generiert Gruppenphase mit Fair Scheduler
  - Generiert Playoffs mit Playoff Scheduler
  - Weist Schiedsrichter zu (falls konfiguriert)
  - Erstellt Phasen-Gruppierung

**Return Type:**
```typescript
GeneratedSchedule {
  tournament: { id, title, date, location, ageClass, organizer?, contactInfo?, groups?, fields? },
  allMatches: ScheduledMatch[],
  phases: SchedulePhase[],
  startTime: Date,
  endTime: Date,
  totalDuration: number,
  numberOfFields: number,
  teams: Array<{ id, name, group? }>,
  initialStandings: Standing[],
  refereeConfig?: RefereeConfig
}
```

**Interne Funktionen:**
- `generateMatches(tournament, startTime)` - Generiert Group + Final Matches
- `generateGroupStageMatches(tournament, startTime)` - Round-Robin pro Gruppe
- `generateFinalMatches(tournament, groupMatches, startTime)` - Playoff-Matches
- `scheduleFinalMatches(...)` - Scheduliert Finals mit korrekter startMatchNumber
- `createPhases(allMatches, groupStageCount)` - Gruppiert nach Turnier-Phase

---

### `/src/lib/pdfExporter.ts` - PDF Export (KOMPLETT NEU)
**Zweck**: Generiert druckfertigen PDF-Spielplan mit HTML-basiertem Layout

**Architektur:**
- Basiert auf HTML-Referenz-Layout
- A4 Portrait (210mm × 297mm)
- Margins: 14mm top, 16mm bottom, 16mm left/right
- Grayscale-Farben: border (#e5e7eb), headBg (#f9fafb), textMain (#111827), textMuted (#6b7280)
- Modularer Aufbau mit separaten Render-Funktionen

**Hauptfunktion:**
- `exportScheduleToPDF(schedule, standings?, options)` - Zeile 129-206
  - Parameter: GeneratedSchedule, Standing[] | undefined, PDFExportOptions
  - Options: locale, includeStandings, organizerName, hallName
  - Erstellt PDF mit allen Sektionen

**Render-Funktionen:**
1. `renderHeader(doc, schedule, yPos)` - Zeile 215-237
   - **Dynamischer Titel**: schedule.tournament.title (zentriert)
   - Untertitel: schedule.tournament.ageClass

2. `renderMetaBox(doc, schedule, t, organizerName, hallName, yPos)` - Zeile 247-358
   - **2-Spalten Layout** mit einzelnem abgerundeten Rahmen
   - Linke Spalte: Veranstalter, Halle, Spieltag, Zeit
   - Rechte Spalte: Modus, Spielzeit, Pause
   - Labels dynamisch mit ":" versehen (Zeile 342, 359)
   - Automatische Label-Breiten-Berechnung für Ausrichtung

3. `renderHints(doc, t, yPos)` - Zeile 363-376
   - Nur Ergebniseintragung-Hinweis (SR-Erklärung entfernt)

4. `renderParticipants(doc, schedule, t, yPos)` - Zeile 382-523
   - **Spezialfall für 1 Gruppe** (Zeile 421-448): Volle Breite, kein Gruppentitel
   - **Multi-Gruppe** (Zeile 450-519): 2 Gruppen nebeneinander in Boxen
   - **Kontinuierliche Team-Nummerierung** (Zeile 418, 429): 1, 2, 3... über alle Gruppen
   - Alphabetische Sortierung innerhalb Gruppen (Zeile 409)
   - Gruppen alphabetisch sortiert (Zeile 411)

5. `renderGroupStage(doc, matches, hasGroups, t, refereeConfig, numberOfFields, yPos)` - Zeile 528-620
   - Vorrunde-Tabelle: Nr | Zeit | Feld (optional) | Gr (optional) | Heim | Ergebnis | Gast | SR (optional)
   - Feld-Spalte nur bei numberOfFields > 1 (Zeile 552)
   - Gruppen-Spalte nur bei mehreren Gruppen (Zeile 541-542)

6. `renderFinalsSection(doc, phases, t, refereeConfig, numberOfFields, yPos)` - Zeile 626-684
   - Phasentitel linksbündig (Zeile 642)
   - Sortiert Matches nach matchNumber (Zeile 646)
   - Gruppiert aufeinanderfolgende Matches mit gleichem finalType (Zeile 649-675)
   - Separate Sub-Tabellen für Platzierungsspiele (Platz 3, 5, 7)

7. `renderFinalsTable(doc, matches, t, refereeConfig, numberOfFields, yPos, subtitle?)` - Zeile 710-800
   - Optional Subtitle für Platzierungsspiele (Zeile 722-729)
   - Nr | Zeit | Feld (optional) | Heim | Ergebnis | Gast | SR (optional)
   - Dynamische Column-Styles basierend auf numberOfFields

8. `renderGroupStandings(doc, schedule, standings, t, yPos)` - Zeile 805-908
   - Separate Tabelle pro Gruppe
   - Format: "Tabelle – Gruppe X"
   - Pl | Team | Sp | S | U | N | Tore | Diff | Pkt
   - 4mm zusätzlicher Abstand zwischen Gruppen (Zeile 903)

**PDF Style Configuration:**
```typescript
PDF_STYLE = {
  colors: { border, borderDark, headBg, textMain, textMuted, white },
  fonts: { h1: 18, h2: 15, meta: 11, sectionTitle: 13, table: 12, hint: 10 },
  spacing: { pageMargin: {top:14, bottom:16, left:16, right:16}, sectionGap: 6, blockGap: 4 }
}
```

**Translations:**
- Deutsche Übersetzungen in TRANSLATIONS.de
- Struktur für zukünftige Internationalisierung vorbereitet

**Integration:**
- Aufgerufen in TournamentPreview.tsx Zeile 128-135
- Parameter: schedule, schedule.initialStandings, { locale, includeStandings, organizerName, hallName }

---

### `/src/lib/refereeAssigner.ts` - Schiedsrichter-Zuweisung
**Zweck**: Automatische und manuelle Zuweisung von Schiedsrichtern zu Spielen

**Wichtige Funktionen:**
- `assignReferees<T>(matches, teams, config)` - **Hauptfunktion**: Weist SR zu allen Matches zu
  - Zeile 38-57: Switch über mode: 'organizer' | 'teams' | 'none'
  - Zeile 48: Wendet zuerst manuelle Zuweisungen an
- `assignOrganizerReferees(matches, config)` - **Veranstalter-Modus**
  - Zeile 72-174: Faire Verteilung mit Workload-Tracking
  - Zeile 104-106: Tracking von refereeWorkload + refereeLastSlots
  - Zeile 113-139: **Sortierung**: Primary = least workload, Secondary = longest rest
  - Zeile 133: Prüfung maxConsecutive Constraint
- `assignTeamReferees(matches, teams)` - **Teams-Modus**
  - Zeile 171-246: Teams pfeifen nach eigenem Spiel
  - Zeile 200-214: Gruppierung nach Feldern
  - Zeile 208: Home-Team vom vorherigen Spiel wird SR
- `applyManualAssignments(matches, config)` - Überschreibt automatische Zuweisung
  - Zeile 49-74: Wendet config.manualAssignments an

**Algorithmus Organizer-Modus:**
```typescript
// Fair Distribution:
1. Sortiere Matches nach Zeitslot
2. Für jedes Match:
   - Sortiere Referees nach: 1) Workload, 2) Rest-Zeit
   - Prüfe maxConsecutive Constraint
   - Weise SR mit niedrigster Belastung zu
3. Fallback: Bei Constraint-Verletzung → SR mit längster Pause
```

---

### `/src/utils/calculations.ts` - Tabellen-Berechnung & Platzierungslogik
**Zweck**: Berechnet Standings und sortiert nach Platzierungskriterien

**Wichtige Funktionen:**
- `calculateStandings(teams, matches, tournament, group?)` - Zeile 6-73
  - Berechnet Punkte, Tore, Tordifferenz für alle Teams
  - Filtert Matches für spezifische Gruppe oder alle Spiele (ohne Finals)
  - Sortiert mit `sortByPlacementLogic()`

- `sortByPlacementLogic(standings, placementLogic, matches?)` - Zeile 78-123
  - Sortiert nach aktivierten Kriterien in Reihenfolge
  - Unterstützt: points, goalDifference, goalsFor, goalsAgainst, wins, directComparison
  - Zeile 101-109: **directComparison** nur wenn alle vorherigen Kriterien gleich

- `compareDirectMatches(a, b, matches)` - Zeile 130-209
  - **Direkter Vergleich** (Mini-Tabelle aus direkten Begegnungen)
  - Fixe Kriterien-Reihenfolge:
    1. Punkte aus direkten Spielen
    2. Tordifferenz aus direkten Spielen
    3. Geschossene Tore aus direkten Spielen
  - Zeile 136-145: Findet alle direkten Matches zwischen zwei Teams
  - Zeile 157-184: Berechnet Mini-Tabelle Stats
  - Zeile 187-206: Vergleicht nach fixer Reihenfolge

- `getQualifiedTeams(standings, count)` - Zeile 210-212
  - Gibt Top N Teams aus Standings zurück

**Platzierungs-Kriterien:**
```typescript
PlacementCriterion {
  id: 'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'wins' | 'directComparison',
  label: string,
  enabled: boolean
}
```

---

### `/src/utils/fairScheduler.ts` - Faire Spielplan-Verteilung
**Zweck**: Generiert fairen Spielplan mit optimaler Feld- und Zeit-Verteilung

**Wichtige Funktionen:**
- `generateGroupPhaseSchedule(options)` - Hauptfunktion
  - Parameter: groups, numberOfFields, slotDurationMinutes, breakBetweenSlotsMinutes, minRestSlotsPerTeam, startTime
  - Generiert Matches mit optimaler Verteilung
  - Slot-basiertes System für faire Pausen

**Algorithmus:**
1. Generiert Round-Robin Matches pro Gruppe
2. Verteilt Matches auf Slots mit fairen Pausen
3. Respektiert minRestSlotsPerTeam Constraint
4. Optimiert Feld-Auslastung

---

### `/src/components/ScheduleDisplay.tsx` - Haupt-Display-Komponente
**Zweck**: Zeigt kompletten Spielplan mit allen Phasen

**Props:**
- `schedule: GeneratedSchedule` - Kompletter Schedule
- `currentStandings?: Standing[]` - Optionale aktuelle Tabelle
- `showQRCode?: boolean` - QR-Code für Live-Tracking
- `qrCodeUrl?: string` - QR-Code URL
- `logoUrl?: string` - Logo URL
- `editable?: boolean` - Ermöglicht SR/Feld-Änderung
- `onRefereeChange?: (matchId, refereeNumber) => void` - Callback für SR-Änderungen
- `onFieldChange?: (matchId, fieldNumber) => void` - Callback für Feld-Änderungen

**Komponenten:**
- Zeile 73-77: TournamentHeader
- Zeile 80-85: ParticipantsAndGroups (nur bei Gruppenturnieren)
- Zeile 88-98: GroupStageSchedule
- Zeile 101-107: GroupTables
- Zeile 109-119: FinalStageSchedule

**Editable Mode:**
- Props werden an Child-Components durchgereicht
- onRefereeChange und onFieldChange werden an GroupStageSchedule/FinalStageSchedule übergeben

---

### `/src/components/schedule/ParticipantsAndGroups.tsx` - Teilnehmer-Anzeige
**Zweck**: Zeigt Teams nach Gruppen organisiert mit kontinuierlicher Nummerierung

**Wichtige Features:**
- Zeile 24-34: **Kontinuierliche Team-Nummerierung** über alle Gruppen hinweg
  - Erstellt teamNumberMap mit fortlaufenden Nummern (1, 2, 3...)
  - Wichtig für "Teams stellen Schiedsrichter" Modus (Team-Nummer = SR-Nummer)
- Zeile 80-81: **Spezialfall einzelne Gruppe** - Gruppentitel wird ausgeblendet
- Zeile 89: Gruppentitel nur anzeigen wenn showGroupTitles = true
- Zeile 115-131: `getGroupStandings()` Funktion
  - Zeile 122: Gruppen alphabetisch sortiert
  - Zeile 130: Teams alphabetisch innerhalb Gruppe sortiert
  - **Wichtig**: Sortierung muss mit PDF-Export übereinstimmen!

**Team-Nummerierung Logik:**
```typescript
// 1. Gruppen alphabetisch sortieren (A, B, C...)
// 2. Teams innerhalb Gruppe alphabetisch sortieren
// 3. Durchgehende Nummerierung: Gruppe A (1-5), Gruppe B (6-10)...
// → Identisch mit PDF-Export für konsistente SR-Nummern
```

---

### `/src/components/schedule/GroupStageSchedule.tsx` - Gruppenphase-Tabelle
**Zweck**: Zeigt Gruppenphase-Spiele mit optionaler SR/Feld-Bearbeitung

**Wichtige Features:**
- Zeile 33-34: `showReferees` und `showFields` basierend auf Config
- Zeile 36-58: Dropdown-Optionen für SR und Felder
- Zeile 60-82: **Feld-Konflikt-Erkennung** (findFieldConflict)
  - Prüft zeitliche Überschneidungen auf gleichem Feld
  - Zeile 75-77: Overlap-Logik: `(start1 < end2) AND (start2 < end1)`
- Zeile 98-133: SR-Spalte mit editierbarem Dropdown oder statischer Anzeige
- Zeile 143-187: Feld-Spalte mit editierbarem Dropdown und Konflikt-Warnung
  - Zeile 150-159: window.confirm() bei Zeitkonflikt

**Tabellen-Struktur:**
- Nr | SR (optional) | Zeit | Gr (optional) | Heim | Ergebnis | Gast | Feld (optional)

**Editable Mode:**
- Native `<select>` Dropdowns für direkte Änderung
- Zeile 100-126: SR-Dropdown mit onChange-Handler
- Zeile 145-181: Feld-Dropdown mit Konflikt-Prüfung

---

### `/src/components/schedule/FinalStageSchedule.tsx` - Finalrunden-Tabelle
**Zweck**: Zeigt Finalrunden-Spiele mit optionaler SR/Feld-Bearbeitung

**Wichtige Features:**
- Zeile 31-32: `showReferees` und `showFields` basierend auf Config
- Zeile 34-56: Dropdown-Optionen für SR und Felder
- Zeile 58-80: **Feld-Konflikt-Erkennung** (identisch zu GroupStageSchedule)
- Zeile 97-132: SR-Spalte mit editierbarem Dropdown
- Zeile 143-187: Feld-Spalte mit Konflikt-Warnung
- Zeile 134-141: Spiel-Label mit Team-Namen
  - Format: "Halbfinale" (Label) + "Team A - Team B" (Teams)

**Tabellen-Struktur:**
- Nr | SR (optional) | Zeit | Spiel | Ergebnis | Feld (optional)

**getFinalMatchLabel(match):**
- Zeile 131-157: Bestimmt Spiel-Label basierend auf finalType und phase
- Finale: 🏆 Finale, Platz 3: 🥉, Platz 5/7: Text

---

### `/src/components/match-cockpit/` - Live-Spielverwaltung (Admin Cockpit)
**Zweck**: Admin-Cockpit für Live-Spielverwaltung während des Turniers

**Architektur:**
- **Reine Präsentationskomponenten** - Alle Daten über Props, keine API-Calls
- **Single Source of Truth** - Backend/Container ist die Wahrheit, UI nur Darstellung
- **Callbacks-Only** - Komponenten feuern nur Events nach oben (onStart, onGoal, etc.)
- **Wiederverwendung** - Nutzt zentrale UI-Komponenten (Button, Card) und Theme-System

**Komponenten:**
1. `MatchCockpit.tsx` - Hauptkomponente (Layout + Header)
   - Props: fieldName, tournamentName, currentMatch, upcomingMatches, callbacks, onAdjustTime
   - Zeile 120-140: Header mit Turnier/Feld-Name und Status-Chips
   - Zeile 165-190: Main-Layout (2-spaltig: CurrentMatchPanel + UpcomingMatchesSidebar)
   - Zeile 206-232: StatusChip und WarningChip Komponenten

2. `CurrentMatchPanel.tsx` - Aktuelles Spiel Panel
   - Props: currentMatch, lastFinishedMatch, callbacks, onAdjustTime
   - Zeile 60-90: LastMatchBanner (Wiedereröffnen letztes Spiel)
   - Zeile 110-145: MatchMeta (Schiedsrichter, Spiel-ID, Dauer)
   - Zeile 160-200: Scoreboard (3-spaltig: Home | Center | Away)
   - Zeile 220-265: TeamBlock (Name, Score, Tor-Buttons)
   - Zeile 280-350: CenterBlock (Timer, Status, Controls, **Zeit-Editor**)
   - Zeile 462-477: **handleTimeClick()** - Manuelle Zeitanpassung mit MM:SS Format
   - Zeile 370-420: FinishPanel (bei Spielende)
   - Zeile 440-510: EventsList (Ereignisse mit Undo)

3. `UpcomingMatchesSidebar.tsx` - Anstehende Spiele
   - Props: upcomingMatches, highlightMinutesBefore
   - Zeile 70-140: NextMatchCard (Highlight bei < 5 Min)
   - Zeile 160-180: calculateMinutesUntil() Utility

**Type Definitions:**
```typescript
type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

interface LiveMatch {
  id: string;
  number: number;
  phaseLabel: string;
  fieldId: string;
  scheduledKickoff: string;
  durationSeconds: number;
  refereeName?: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  elapsedSeconds: number;  // Von außen gesteuert (kein interner Timer!)
  events: MatchEvent[];
}

interface MatchEvent {
  id: string;
  matchId: string;
  timestampSeconds: number;
  type: 'GOAL' | 'RESULT_EDIT' | 'STATUS_CHANGE';
  payload: { teamId?, direction?, newHomeScore?, newAwayScore?, toStatus? };
  scoreAfter: { home: number; away: number };
}
```

**Features:**
- ⚽ Live-Scoreboard mit Team-Blöcken
- ⏱️ Timer (gesteuert von außen via elapsedSeconds Prop)
- ⌚ **Klickbarer Timer** - Manuelle Zeitanpassung (Format: MM:SS)
- 🎮 Spiel-Controls (Start, Pause, Beenden)
- ➕ Tor-Buttons (+1/-1 pro Team)
- 📜 Event-Liste mit Undo-Funktion
- ✏️ Manuelles Ergebnis anpassen
- ✅ Finish-Panel bei Spielende
- 📅 Sidebar mit anstehenden Spielen
- ⚠️ Warnung bei nächstem Spiel < 5 Min
- 🔄 Wiedereröffnen letztes Spiel

**Production-Integration:**
- Container muss State Management übernehmen (Redux/Zustand/Context)
- Container führt API-Calls in Callback-Handlern durch
- Container updated elapsedSeconds via Interval oder WebSocket
- Beispiel-Container: `MatchCockpitDemoScreen.tsx`

**Mapping von existierenden Types:**
```typescript
// Aus ScheduledMatch → LiveMatch
function mapToLiveMatch(scheduledMatch: ScheduledMatch, liveData: LiveData): LiveMatch {
  return {
    id: scheduledMatch.id,
    number: scheduledMatch.matchNumber,
    phaseLabel: scheduledMatch.phase || 'Vorrunde',
    fieldId: `field-${scheduledMatch.field}`,
    scheduledKickoff: scheduledMatch.time,
    durationSeconds: scheduledMatch.duration * 60,
    refereeName: getRefereeNameFromNumber(scheduledMatch.referee),
    homeTeam: { id: ..., name: scheduledMatch.homeTeam },
    awayTeam: { id: ..., name: scheduledMatch.awayTeam },
    // ... Live-Daten vom Backend
  };
}
```

---

### `/src/features/tournament-management/` - Live-Turnierverwaltung
**Zweck**: Verwaltung veröffentlichter Turniere mit Tabs für verschiedene Ansichten

**Hauptkomponenten:**

1. **TournamentManagementScreen.tsx** - Container mit Tab-Navigation
   - Tabs: Spielplan, Gruppen-Tabelle, Platzierung, Turnierleitung, Monitor
   - Zeile 43-147: Tournament Loading mit Migration für alte Turniere
   - Zeile 104-128: **ID-Synchronisierung** zwischen tournament.matches und schedule
   - Zeile 149-201: handleTournamentUpdate() - Zentrale Update-Funktion
   - Zeile 162-193: Bedingte Schedule-Regenerierung (regenerateSchedule flag)

2. **ManagementTab.tsx** - Turnierleitung (Kampfgericht)
   - Live-Spielverwaltung mit MatchCockpit
   - Zeile 39-56: LiveMatch State Management in localStorage
   - Zeile 59-80: Timer für laufende Spiele (1-Sekunden-Interval)
   - Zeile 158-190: **getLiveMatchData()** - Erstellt LiveMatch sofort bei Zugriff, lädt bestehende Ergebnisse
   - Zeile 213-286: handleStart() - Status → RUNNING, Warnung bei vorhandenen Ergebnissen
   - Zeile 288-310: handlePause() - Status → PAUSED
   - Zeile 279-310: handleResume() - Status → RUNNING (von PAUSED)
   - Zeile 312-370: handleFinish() - Status → FINISHED, speichert Ergebnis
   - Zeile 372-396: handleGoal() - Torzählung mit MatchEvent
   - Zeile 398-458: handleUndoLastEvent() - Rückgängig letztes Event
   - Zeile 405-458: handleManualEditResult() - Manuelles Ergebnis
   - Zeile 477-495: **handleAdjustTime()** - Manuelle Zeitanpassung
   - Zeile 497-521: **handleMatchSelectionChange()** - Warnung bei laufendem Spiel
   - Zeile 145-156: **Match-Selektor** - Automatisch oder manuell auswählbar
   - Zeile 496-514: Match Selector UI mit Dropdown

3. **ScheduleTab.tsx** - Bearbeitbarer Spielplan
   - Zeile 35-47: handleScoreChange() - Direkte Ergebniseingabe in Tabelle
   - Zeile 49-71: handleRefereeAssignment() - SR-Zuweisung
   - Zeile 87-99: handleFieldChange() - Feld-Zuweisung
   - Zeile 111-119: ScheduleDisplay mit editable=true

4. **TableTab.tsx** - Gruppen-Tabellen
   - Zeigt aktuelle Tabellenstände pro Gruppe
   - Live-Berechnung nach jedem Ergebnis

5. **RankingTab.tsx** - Finale Platzierung
   - Zeile 98-174: **getFinalRanking()** - Berechnet Endplatzierung
   - Zeile 99-103: Jeder-gegen-Jeden → currentStandings
   - Zeile 105-173: Gruppenturniere → Erst Gruppensieger, dann beste Zweite
   - Zeile 181-183: Fullscreen Button für Monitor-Modus

6. **MonitorTab.tsx** - Zuschauer-Ansicht
   - Große Anzeige für Publikum
   - Zeigt aktuelle Tabellen und Ergebnisse

---

### 📦 MonitorTab Extrahierte Komponenten

Die MonitorTab-Logik wurde in wiederverwendbare Komponenten extrahiert:

| Komponente | Pfad | Zweck |
|------------|------|-------|
| `NextMatchCard` | `components/NextMatchCard.tsx` | Nächstes Spiel mit Countdown |
| `StandingsDisplay` | `components/StandingsDisplay.tsx` | Tabellen-Anzeige für Monitor |

---

#### `/src/features/tournament-management/components/NextMatchCard.tsx`
**Zweck**: Zeigt das nächste anstehende Spiel mit Countdown und Meta-Infos

**Interface:**
```typescript
interface NextMatchInfo {
  match: ScheduledMatch;
  metaStyle?: CSSProperties;
}

interface NextMatchCardProps {
  match: ScheduledMatch;
  metaStyle?: CSSProperties;
}
```

**Features:**
- Spielnummer und Uhrzeit
- Heim vs. Auswärts Team
- Feld-Anzeige
- Optional: Schiedsrichter
- Responsive Design für große Displays

---

#### `/src/features/tournament-management/components/StandingsDisplay.tsx`
**Zweck**: Wiederverwendbare Tabellen-Anzeige für Monitor-Modus

**Interface:**
```typescript
interface StandingsDisplayProps {
  standings: Standing[];
  title?: string;
}

interface StandingsTableProps {
  standings: Standing[];
}
```

**Features:**
- Kompakte Tabellen-Darstellung (Pl, Team, Sp, S, U, N, Tore, Diff, Pkt)
- Optimiert für große Bildschirme
- Konsistentes Styling mit Theme

---

**LiveMatch State Management:**
```typescript
// ManagementTab.tsx
const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(() => {
  const stored = localStorage.getItem(`liveMatches-${tournament.id}`);
  return stored ? new Map(Object.entries(JSON.parse(stored))) : new Map();
});

// Persistierung
useEffect(() => {
  const obj = Object.fromEntries(liveMatches.entries());
  localStorage.setItem(`liveMatches-${tournament.id}`, JSON.stringify(obj));
}, [liveMatches, tournament.id]);
```

**MatchEvent Structure:**
```typescript
interface MatchEvent {
  id: string;
  matchId: string;
  timestampSeconds: number;  // Spielzeit bei Event
  type: 'GOAL' | 'RESULT_EDIT' | 'STATUS_CHANGE';
  payload: {
    teamId?: string;
    direction?: 'INC' | 'DEC';
    newHomeScore?: number;
    newAwayScore?: number;
    toStatus?: MatchStatus;
  };
  scoreAfter: {
    home: number;
    away: number;
  };
}
```

**Features:**
- 🎮 Live-Spielsteuerung pro Feld
- 🔄 Automatische Spielprogression nach Spielende
- 📝 Match-Selektor für nachträgliche Bearbeitung
- ⏱️ Manuelle Zeitanpassung (MM:SS Format)
- ⏯️ Dedizierte Pause/Fortsetzen-Funktion
- ⚠️ Warnungen bei Ergebnis-Überschreibung
- ⚠️ Warnung bei Match-Wechsel während laufendem Spiel
- 💾 Persistierung in localStorage
- 📊 Live-Tabellen mit Auto-Update
- 🏆 Finale Platzierungsberechnung
- 📺 Monitor-Modus für Publikum

---

### `/src/components/RefereeAssignmentEditor.tsx` - Manuelle SR-Zuweisung
**Zweck**: Alternative UI für manuelle SR-Zuweisung mit Drag & Drop

**Wichtige Funktionen:**
- `findOverlappingConflict(matches, targetMatchId, refereeNumber)` - Zeile 21-47
  - Prüft zeitliche Konflikte (SR bereits bei anderem Spiel zur gleichen Zeit)
  - Zeile 34-42: Zeit-Overlap-Logik
  - Gibt konfligierendes Match oder null zurück

**Komponenten:**
- Zeile 270-297: Draggable Referee Cards (nur Organizer-Modus)
- Zeile 304-358: Matches-Liste mit Dropzones und Select
- Zeile 324-355: Dropdown mit Konflikt-Prüfung

**Konflikt-Behandlung:**
- Zeile 136-155: Drag & Drop - window.confirm() bei Zeitkonflikt
- Zeile 332-348: Dropdown - window.confirm() bei Zeitkonflikt
- User kann Konflikt überschreiben (manuell hat Vorrang)

---

### `/src/features/tournament-creation/TournamentPreview.tsx` - Vorschau & Bearbeitung
**Zweck**: Zeigt Turnier-Vorschau mit Bearbeitungsmöglichkeit

**Wichtige Funktionen:**
- Zeile 51-82: `handleRefereeAssignment(matchId, refereeNumber)` - SR-Änderung
  - Aktualisiert manualAssignments
  - Regeneriert Schedule
  - Notifiziert Parent-Component

- Zeile 106-126: `handleFieldChange(matchId, fieldNumber)` - Feld-Änderung
  - Aktualisiert fieldAssignments
  - Regeneriert Schedule
  - Notifiziert Parent-Component

- Zeile 128-135: `handleExportPDF()` - PDF Export
  - Ruft exportScheduleToPDF() auf
  - Übergibt schedule, standings, options

**Props an ScheduleDisplay:**
- Zeile 354-359: editable={true}, onRefereeChange, onFieldChange
- Ermöglicht direkte SR/Feld-Änderung in Tabellen

---

### `/src/features/tournament-creation/Step2_ModeAndSystem.tsx` - Turnier-Konfiguration
**Zweck**: Konfiguration von Modus, Gruppen, Finalrunden, Schiedsrichtern, Feldern

**Wichtige Sektionen:**
1. Zeile 50-150: Gruppen-Konfiguration
2. Zeile 152-250: Finalrunden-Konfiguration (finalsConfig)
3. Zeile 252-350: Schiedsrichter-Konfiguration (refereeConfig)
4. Zeile 352-400: Feld-Anzahl und weitere Einstellungen

**Finals Config:**
- Preset-Auswahl: none, final-only, top-4, top-8, top-16, all-places
- Parallel-Optionen: parallelSemifinals, parallelQuarterfinals, parallelRoundOf16

**Referee Config:**
- Mode-Auswahl: none, organizer, teams
- Organizer-Modus: numberOfReferees, maxConsecutiveMatches
- Finals-Referee-Mode: none, neutralTeams, nonParticipatingTeams

---

## 🔄 Datenfluss: Komplett

```
1. User konfiguriert Turnier in Step2_ModeAndSystem.tsx
   ↓ finalsConfig: { preset: 'top-4', parallelSemifinals: true }
   ↓ refereeConfig: { mode: 'organizer', numberOfReferees: 3, maxConsecutiveMatches: 1 }
   ↓ numberOfFields: 2

2. playoffGenerator.generatePlayoffMatches(numberOfGroups, finalsConfig)
   ↓ Erstellt PlayoffMatch[] mit home/away Platzhaltern
   ↓ z.B. { home: 'semi1-loser', away: 'semi2-loser' }

3. playoffScheduler.generatePlayoffDefinitions()
   ↓ Konvertiert zu PlayoffMatchDefinition[]
   ↓ teamASource = 'semi1-loser', teamBSource = 'semi2-loser'

4. playoffScheduler.generatePlayoffSchedule()
   ↓ Erstellt Match[] mit Slots/Fields
   ↓ teamA = 'semi1-loser', teamB = 'semi2-loser'

5. scheduleGenerator.scheduleMatches()
   ↓ Erstellt ScheduledMatch[] mit Zeiten
   ↓ homeTeam = resolveTeamName('semi1-loser') → 'Verlierer HF 1'
   ↓ matchNumber = fortlaufend ab startMatchNumber
   ↓ startTime, endTime = berechnet

6. scheduleGenerator: assignReferees()
   ↓ refereeAssigner.assignReferees(allMatches, teams, refereeConfig)
   ↓ Weist SR-Nummern zu: match.referee = 1, 2, 3...
   ↓ Respektiert manualAssignments

7. TournamentPreview.tsx
   ↓ Zeigt ScheduleDisplay mit editable=true
   ↓ Passes onRefereeChange={handleRefereeAssignment}
   ↓ Passes onFieldChange={handleFieldChange}

8. ScheduleDisplay → GroupStageSchedule / FinalStageSchedule
   ↓ Props: editable, onRefereeChange, onFieldChange werden durchgereicht
   ↓ SR-Spalte als zweite Spalte (nach Nr.)
   ↓ Feld-Spalte als letzte Spalte (wenn numberOfFields > 1)

9. User ändert SR/Feld in Tabelle
   ↓ Dropdown onChange → onRefereeChange(matchId, refereeNumber)
   ↓ Dropdown onChange → onFieldChange(matchId, fieldNumber)
   ↓ Konflikt-Prüfung bei Feld-Änderung
   ↓ TournamentPreview: regeneriert Schedule mit neuer Zuweisung

10. User exportiert PDF
   ↓ handleExportPDF() → exportScheduleToPDF(schedule, standings, options)
   ↓ Rendert Header (dynamisch: tournament.title + ageClass)
   ↓ Rendert Meta-Box (4-Spalten Grid)
   ↓ Rendert Hints
   ↓ Rendert Participants (globale Nummerierung)
   ↓ Rendert GroupStage Table
   ↓ Rendert Group Standings (2-Spalten)
   ↓ Rendert Finals Tables (separate Tabellen pro Phase)
   ↓ Speichert PDF: {tournament.title}_Spielplan.pdf
```

---

## 🎯 Häufige Änderungen & wo sie gemacht werden

### PDF-Layout ändern
**Datei**: `/src/lib/pdfExporter.ts`
- Zeile 23-53: PDF_STYLE - Farben, Fonts, Spacing
- Zeile 196-218: renderHeader() - Header-Layout
- Zeile 220-308: renderMetaBox() - Meta-Box Layout
- Zeile 341-411: renderParticipants() - Teilnehmer-Layout
- Zeile 413-497: renderGroupStage() - Vorrunde-Tabelle
- Zeile 626-735: renderGroupStandings() - Tabellen-Layout

### Team-Nummerierung ändern
**Datei**: `/src/lib/pdfExporter.ts`, Zeile 355-360
```typescript
// Globale Team-Nummerierung
const teamNumbers = new Map<string, number>();
let globalNumber = 1;
schedule.teams.forEach(team => {
  teamNumbers.set(team.id, globalNumber++);
});
```

### Platzierungskriterien ändern
**Datei**: `/src/utils/calculations.ts`
- Zeile 78-123: sortByPlacementLogic() - Kriterien-Reihenfolge
- Zeile 130-209: compareDirectMatches() - Direkter Vergleich Logik
- Zeile 90-110: Switch über criterion.id - Neue Kriterien hinzufügen

### Feld-Konflikt-Logik ändern
**Dateien**:
- `/src/components/schedule/GroupStageSchedule.tsx` - Zeile 60-82
- `/src/components/schedule/FinalStageSchedule.tsx` - Zeile 58-80
- Overlap-Prüfung: `(start1 < end2) AND (start2 < end1)`

### SR-Anzeige in PDF ändern
**Datei**: `/src/lib/pdfExporter.ts`
- Zeile 438-441: Header-Row mit SR-Spalte
- Zeile 455-457: Data-Row mit SR-Nummer oder '-'
- Zeile 488: columnStyles für SR-Spalte

### Neue Playoff-Runde hinzufügen
1. **tournament.ts**: Erweitere `FinalsPreset` um `'top-32'`
2. **playoffGenerator.ts**: Erstelle `generateTop32()` Funktion
3. **finalsOptions.ts**: Füge Top-32 zu `getFinalsOptions()` hinzu
4. **scheduleGenerator.ts**: Erweitere `translatePlaceholder()` um r32-x-winner/loser
5. **playoffScheduler.ts**: Erweitere parallelMode Detection

---

## 🐛 Debugging-Tipps

### Problem: PDF-Export funktioniert nicht
**Check**: Browser Console für Fehler
**Check**: `exportScheduleToPDF` wird mit korrekten Parametern aufgerufen (TournamentPreview.tsx Zeile 129)
**Check**: schedule.tournament.title ist gesetzt

### Problem: Team-Nummerierung falsch
**Check**: pdfExporter.ts Zeile 355-360 - Globale Nummerierung
**Check**: Reihenfolge von schedule.teams

### Problem: Tabellen sortieren nicht korrekt
**Check**: calculations.ts Zeile 78-123 - placementLogic
**Check**: tournament.placementLogic enthält korrekte Kriterien mit enabled: true
**Check**: compareDirectMatches() wird korrekt aufgerufen

### Problem: Feld-Konflikte werden nicht erkannt
**Check**: findFieldConflict() in GroupStageSchedule.tsx Zeile 60-82
**Check**: match.startTime und match.endTime sind korrekt gesetzt
**Check**: Overlap-Logik: `(targetStart < matchEnd && matchStart < targetEnd)`

### Problem: SR-Spalte wird nicht angezeigt
**Check**: schedule.refereeConfig wird korrekt durchgereicht
**Check**: `showReferees = refereeConfig && refereeConfig.mode !== 'none'`
**Check**: Props werden an GroupStageSchedule/FinalStageSchedule übergeben

### Problem: Feld-Spalte wird nicht angezeigt
**Check**: `showFields = numberOfFields > 1`
**Check**: schedule.numberOfFields ist > 1
**Check**: Props werden korrekt durchgereicht

### Problem: Manuelle Zuweisungen funktionieren nicht
**Check**: onRefereeChange und onFieldChange Callbacks sind definiert
**Check**: TournamentPreview.tsx regeneriert Schedule nach Änderung
**Check**: manualAssignments und fieldAssignments werden korrekt aktualisiert

### Problem: "semi1-loser" wird nicht übersetzt
**Check**: scheduleGenerator.ts Zeile 500-628 - Übersetzungstabelle
**Check**: Platzhalter ist in TRANSLATIONS.de vorhanden

---

## 🧪 Testing & Quality Assurance

### Testing Stack

| Tool | Zweck | Konfiguration |
|------|-------|---------------|
| **Vitest** | Unit & Integration Tests | `vitest.config.ts` |
| **React Testing Library** | Component Tests | `src/test/setup.ts` |
| **Husky** | Pre-commit Hooks | `.husky/pre-commit` |
| **ESLint** | Static Code Analysis | `eslint.config.js` |
| **GitHub Actions** | CI/CD Pipeline | `.github/workflows/ci.yml` |

---

### `/vitest.config.ts` - Test-Konfiguration

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  }
});
```

---

### `/src/test/setup.ts` - Test Setup

**Konfiguriert:**
- `@testing-library/jest-dom` für erweiterte Matcher
- Globale Test-Utilities

---

### `/src/test/testUtils.tsx` - Custom Render

Wrapper für Tests mit Providern (Toast, Context, etc.):

```typescript
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    {children}
  </ToastProvider>
);

export const renderWithProviders = (ui: React.ReactElement) =>
  render(ui, { wrapper: AllProviders });
```

---

### `/src/test/factories.ts` - Test Data Factories

Factory-Funktionen für konsistente Test-Daten:

```typescript
export const createMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 'test-tournament-1',
  title: 'Test Turnier',
  // ... defaults
  ...overrides
});

export const createMockMatch = (overrides?: Partial<Match>): Match => ({ ... });
export const createMockTeam = (overrides?: Partial<Team>): Team => ({ ... });
```

---

### CI/CD Pipeline

**`.github/workflows/ci.yml`**:

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --run --reporter=verbose
      - run: npm run build
```

**Trigger:**
- Push auf `main` oder `develop`
- Pull Requests gegen `main` oder `develop`

**Steps:**
1. Checkout Code
2. Node.js 20 Setup mit npm Cache
3. Dependencies installieren (`npm ci`)
4. ESLint ausführen
5. Tests ausführen (non-watch mode)
6. Production Build erstellen
7. Build-Artefakte hochladen (7 Tage Retention)

---

### Pre-Commit Hooks (Husky)

**`.husky/pre-commit`**:
```bash
npx lint-staged
npm run test -- --run
```

**Workflow:**
1. `lint-staged` führt ESLint auf geänderten Dateien aus
2. Tests werden im Single-Run-Modus ausgeführt
3. Commit wird nur bei Erfolg durchgeführt

---

### Test-Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm test` | Startet Vitest im Watch-Modus |
| `npm test -- --run` | Single Run (für CI) |
| `npm test -- --coverage` | Mit Coverage-Report |
| `npm run lint` | ESLint ausführen |
| `npm run lint -- --fix` | ESLint mit Auto-Fix |

---

## 📊 Wichtige Enums & Constants

### Phase Types
```typescript
'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final'
```

### Final Types
```typescript
'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth'
```

### Placement Criteria IDs
```typescript
'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'wins' | 'directComparison'
```

### Referee Modes
```typescript
RefereeMode: 'none' | 'organizer' | 'teams'
FinalsRefereeMode: 'none' | 'neutralTeams' | 'nonParticipatingTeams'
```

### PDF Style Constants
```typescript
PDF_STYLE.colors: border, borderDark, headBg, textMain, textMuted, white
PDF_STYLE.fonts: h1, h2, meta, sectionTitle, phaseTitle, groupTitle, table, hint
PDF_STYLE.spacing: pageMargin, sectionGap, blockGap
```

---

## 📝 Implementierte Features

### ✅ Core Features
- Tournament Creation Flow (4 Steps)
- Fair Scheduler mit Slot-basiertem System
- Playoff-System mit Presets (none, final-only, top-4, top-8, top-16, all-places)
- Schiedsrichter-System (Organizer + Teams Modus)
- Feld-Verwaltung mit Konflikt-Erkennung
- Platzierungs-Logik mit konfigurierbaren Kriterien
- Direkter Vergleich (Head-to-Head)

### ✅ PDF Export (Komplett neu)
- HTML-basiertes Layout
- Dynamischer Header (Turniername aus Stammdaten)
- 4-Spalten Meta-Box
- Globale Team-Nummerierung (1-10)
- Separate Tabellen pro Finalrunden-Phase
- 2-Spalten Gruppen-Tabellen Layout
- "Tabelle – Gruppe X" Format
- SR-Spalte (optional)
- A4 Portrait, Grayscale-optimiert

### ✅ Manuelle Bearbeitung
- SR-Zuweisung via Dropdown in Tabellen
- Feld-Zuweisung via Dropdown in Tabellen
- Zeitliche Konflikt-Erkennung
- User-Bestätigung bei Konflikten
- Automatische Schedule-Regenerierung
- RefereeAssignmentEditor mit Drag & Drop

### ✅ Display Features
- Responsive Tabellen-Ansicht
- Editable Mode für Vorschau
- SR-Spalte (dynamisch basierend auf Config)
- Feld-Spalte (dynamisch basierend auf numberOfFields)
- Gruppierte Teilnehmer-Anzeige
- Gruppen-Tabellen mit Live-Berechnung

### ✅ Tournament Management (NEU)
- Live-Turnierverwaltung mit Tab-Navigation
- Turnierleitung (Kampfgericht) mit MatchCockpit
- Match-Selektor für flexible Spielauswahl
- Manuelle Zeitanpassung (klickbarer Timer)
- Dedizierte Pause/Fortsetzen-Funktion (statt kombinierter Button)
- Warnungen bei Ergebnis-Überschreibung (Spielplan → Live)
- Warnung bei Match-Wechsel während laufendem Spiel
- LiveMatch State mit localStorage-Persistierung
- MatchEvent-System für vollständige Event-Historie
- Verbesserte Event-Liste mit Emojis und Farbcodierung
- Automatische Spielprogression
- Live-Tabellen mit Auto-Update
- Finale Platzierungsberechnung mit Platzierungslogik-Anzeige
- Monitor-Modus für Publikum
- Bearbeitbarer Spielplan mit direkter Ergebniseingabe

---

## 🔗 Wichtigste Abhängigkeiten

```
Tournament Creation
  ↓
Step2_ModeAndSystem
  ↓ finalsConfig, refereeConfig, numberOfFields, fieldAssignments
  ↓
TournamentPreview
  ↓ generateFullSchedule()
    ↓ fairScheduler.generateGroupPhaseSchedule()
    ↓ playoffScheduler.generatePlayoffSchedule()
    ↓ scheduleGenerator.scheduleMatches()
    ↓ refereeAssigner.assignReferees()
  ↓ ScheduleDisplay (editable mode)
    ↓ GroupStageSchedule (SR/Feld-Dropdowns)
    ↓ FinalStageSchedule (SR/Feld-Dropdowns)
    ↓ GroupTables (calculations.calculateStandings)
  ↓ RefereeAssignmentEditor
  ↓ handleExportPDF()
    ↓ pdfExporter.exportScheduleToPDF()
      ↓ renderHeader()
      ↓ renderMetaBox()
      ↓ renderParticipants()
      ↓ renderGroupStage()
      ↓ renderGroupStandings()
      ↓ renderFinalsSection()
```

---

## 📱 Responsive Design Patterns

### Breakpoints
```typescript
Mobile:   < 768px   // Card-basierte Layouts, Vertical Stacking
Tablet:   768-1024px // Kompakte Tabellen
Desktop:  > 1024px   // Vollständige Tabellen mit allen Spalten
```

### Window Width Detection Hook
**Pattern**: useState + useEffect mit window.addEventListener
```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

**Verwendet in:**
- [RankingTab.tsx:26-33](/Users/daniel.stiegler/Downloads/hallenfussball-pwa/src/features/tournament-management/RankingTab.tsx#L26-L33)
- [TableTab.tsx:19-26](/Users/daniel.stiegler/Downloads/hallenfussball-pwa/src/features/tournament-management/TableTab.tsx#L19-L26)
- [ManagementTab.tsx:86-93](/Users/daniel.stiegler/Downloads/hallenfussball-pwa/src/features/tournament-management/ManagementTab.tsx#L86-L93)

### Mobile Responsive Components

#### `/src/features/tournament-management/RankingTab.tsx`
**Mobile Features:**
- Kondensierte Tabelle: Zeigt nur Platz, Team, Pkt, Diff
- Expandable Rows: Tap-to-Expand für vollständige Statistiken (Sp, S, U, N, Tore)
- Zeile 118-158: Expandable Row Logik mit toggleExpandedRow()
- Zeile 221-241: Desktop → Alle Spalten, Mobile → Nur Essentials

#### `/src/features/tournament-management/TableTab.tsx`
**Mobile Features:**
- Responsive Container Padding: 12px mobile, 24px desktop
- GroupTables mit isMobile Prop
- Zeile 47-78: Responsive Styles mit Media Queries

#### `/src/features/tournament-management/ManagementTab.tsx`
**Mobile Features:**
- Responsive Controls Container
- Größere Match-Selector Buttons auf Mobile
- Vertical Stacking der Controls
- Zeile 132-161: Responsive Match Selector mit isMobile-Styling

#### `/src/features/tournament-management/ScheduleTab.tsx`
**Mobile Features:**
- Responsive Container Padding
- Card-Optimierung für kleine Bildschirme
- Zeile 158-180: Media Queries für Mobile/Tablet/Desktop

#### `/src/features/tournament-creation/TournamentPreview.tsx`
**Mobile Features:**
- Responsive Container mit max-width: 1200px
- Card Padding: 12px mobile, 16px tablet, 20px desktop
- Zeile 348-378: Umfassende Media Queries

#### `/src/components/schedule/GroupStageSchedule.tsx`
**Mobile Features:**
- Card-basiertes Layout auf Mobile (< 767px)
- Tabellen-Layout auf Desktop (≥ 768px)
- Touch-friendly Score Inputs (60x48px)
- Zeile 217-448: Card Styles und Mobile Layout
- Zeile 196-215: Tabellen-Layout für Desktop

#### `/src/components/schedule/FinalStageSchedule.tsx`
**Mobile Features:**
- Identisches Card/Table Pattern wie GroupStageSchedule
- Vertical Stacking der Spiel-Informationen
- Große Touch-Targets für alle interaktiven Elemente
- Zeile 237-467: Card Styles und Responsive Logic

#### `/src/components/schedule/GroupTables.tsx`
**Mobile Features:**
- Responsive Grid: 1 Spalte mobile, 2 Spalten desktop
- Kondensierte Tabelle auf Mobile
- Props: `isMobile?: boolean` für conditional rendering
- Zeile 142-237: Responsive Grid Styles

#### `/src/components/match-cockpit/MatchCockpit.tsx`
**Mobile Features:**
- Single Column Layout auf Mobile
- Responsive Header mit kleineren Chips
- Zeile 203-248: Media Queries für Main Layout

#### `/src/components/match-cockpit/CurrentMatchPanel.tsx`
**Mobile Features:**
- Vertical Stacking aller Elemente
- Timer: 40px font mobile, 26px desktop
- Tor-Buttons: Full width, 48px height
- Control Buttons: 48px height, 100% width
- Zeile 594-697: Umfassende Mobile Styles

#### `/src/components/match-cockpit/UpcomingMatchesSidebar.tsx`
**Mobile Features:**
- Stacked Buttons statt Grid
- Größere Schrift für bessere Lesbarkeit
- Zeile 165-207: Mobile-spezifische Styles

### Design-Prinzipien

**Touch-Targets:**
- Minimum: 44x44px (WCAG 2.1 Level AA)
- NumberStepper Buttons: 44x44px
- Score Inputs: 60x48px
- Control Buttons: 48px height
- Match Cards: 100% width, großzügige Padding

**Typography:**
```typescript
Mobile:
- Headings: 18-20px
- Body: 14-15px
- Small: 11-12px

Desktop:
- Headings: 20-24px
- Body: 15-16px
- Small: 12-13px
```

**Spacing:**
```typescript
Mobile:
- Container Padding: 12-16px
- Card Padding: 12px
- Section Gap: 16px
- Element Gap: 8px

Desktop:
- Container Padding: 24px
- Card Padding: 20px
- Section Gap: 24px
- Element Gap: 12px
```

**Layout Patterns:**
- Mobile: Card-basiert, Vertical Stacking, Single Column
- Desktop: Tabellen, Grid Layouts, Multi-Column
- No Horizontal Scroll on Mobile
- Progressive Disclosure (Expandable Rows)

### CSS-in-JS Pattern
**Embedded Media Queries:**
```typescript
<style>{`
  @media (max-width: 767px) {
    .container {
      padding: 12px !important;
    }
  }

  @media (min-width: 768px) and (max-width: 1024px) {
    .container {
      padding: 20px !important;
    }
  }

  @media (min-width: 1025px) {
    .container {
      padding: 24px !important;
    }
  }
`}</style>
```

**Inline CSSProperties mit Conditional Logic:**
```typescript
const containerStyle: CSSProperties = {
  padding: isMobile ? '12px' : '24px',
  flexDirection: isMobile ? 'column' : 'row',
  fontSize: isMobile ? '14px' : '16px',
};
```

---

**Last Updated**: 2026-01-26
**Version**: 2.5.0 (Supabase Backend + Local-First Architecture + Offline-Sync)
