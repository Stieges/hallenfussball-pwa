# Hallenfußball PWA

Eine modulare Progressive Web App für Hallenfußball-Turnierverwaltung mit React, TypeScript und Vite.

**Repository:** https://github.com/Stieges/hallenfussball-pwa

---

## 📋 Inhaltsverzeichnis

- [Projekt-Setup](#-projekt-setup)
- [Architektur-Übersicht](#-architektur-übersicht)
- [Fair Scheduler System](#-fair-scheduler-system)
- [Projektstruktur](#-projektstruktur)
- [Tech Stack](#-tech-stack)
- [Verfügbare Scripts](#-verfügbare-scripts)
- [Aktueller Status](#-aktueller-status)

---

## 🚀 Projekt-Setup

### Voraussetzungen

- Node.js (v18 oder höher)
- npm oder yarn

### Installation

```bash
cd hallenfussball-pwa
npm install
```

### Development Server starten

```bash
npm run dev
```

Die App läuft dann auf `http://localhost:3001`

### Production Build erstellen

```bash
npm run build
```

### Preview des Production Builds

```bash
npm run preview
```

---

## 🏗️ Architektur-Übersicht

### Kern-Module

1. **Fair Scheduler System** - Intelligente Spielplan-Generierung
2. **Tournament Management** - Turnier-Erstellung und Verwaltung
3. **Schedule Generation** - Zeit-basierte Spielplan-Berechnung
4. **Playoff System** - Finale und Platzierungsspiele

### Datenfluss

```
User Input (UI)
    ↓
Tournament Creation Wizard (5 Steps)
    ↓
Fair Scheduler (generateGroupPhaseSchedule)
    ↓
Playoff Scheduler (generatePlayoffSchedule)
    ↓
Schedule Generator (generateFullSchedule)
    ↓
PDF Export / Display
```

---

## 🎯 Fair Scheduler System

### Überblick

Das Fair Scheduler System ist das Herzstück der App und sorgt für **faire Verteilung von Pausen und Spielzeiten** in der Gruppenphase.

### Kernprinzipien (nach Priorität)

#### 1. **Pausen-Fairness (Höchste Priorität)**
- Minimierung der globalen Varianz: `maxAvgRest - minAvgRest` über ALLE Teams
- Keine Back-to-back Spiele wenn `minRestSlotsPerTeam >= 1`
- Teams mit längeren Pausen werden bevorzugt geplant

#### 2. **Home/Away Balance (Zweite Priorität)**
- Post-Processing nach Zeit-Scheduling
- Ziel: `|homeCount - awayCount| ≤ 1` pro Team
- Swapping ohne Änderung der Slot-Zuordnung

#### 3. **Feld-Verteilung (Dritte Priorität)**
- Teams sollen auf verschiedenen Feldern spielen
- Vermeidung von Feld-Clustering

### Implementierung

#### Datei: `src/utils/fairScheduler.ts`

**Hauptfunktion:**
```typescript
export function generateGroupPhaseSchedule(
  options: GroupPhaseScheduleOptions
): Match[]
```

**Algorithmus:**

1. **Round-Robin Pairing Generation** (Circle Method)
   - Erzeugt faire Paarungen ohne Heim/Gast-Zuweisung
   - Deterministische Rotation: Fix einen Team, rotiere andere

2. **Greedy Scheduling mit Fairness-Heuristik**
   ```typescript
   // Für jeden Slot:
   for each slot:
     for each field:
       candidates = []
       for each remaining pairing:
         score = calculateFairnessScore(pairing, slot, field)
         if score < Infinity:
           candidates.add({pairing, score, longestRest})

       // Sortiere: Längste Pause ZUERST, dann Fairness-Score
       candidates.sort((a, b) => {
         if (a.longestRest !== b.longestRest)
           return b.longestRest - a.longestRest  // Descending
         return a.score - b.score  // Ascending
       })

       schedule(candidates[0])
   ```

3. **Fairness-Score-Berechnung**
   ```typescript
   function calculateFairnessScore(
     teamA, teamB, slot, field, teamStates, minRestSlots
   ): number {
     // 1. Check minimum rest constraint
     if (!canTeamPlayInSlot(teamA, slot) || !canTeamPlayInSlot(teamB, slot))
       return Infinity  // Invalid

     // 2. Calculate global variance AFTER this assignment
     projectedAvgRestByTeam = calculateProjectedAvgRest(teamA, teamB, slot)
     globalVariance = max(projectedAvgRest) - min(projectedAvgRest)
     score += globalVariance * 100  // High weight!

     // 3. Penalize field overuse
     score += fieldImbalance * 10

     // 4. Penalize home/away imbalance
     score += homeAwayImbalance * 5

     return score
   }
   ```

4. **Home/Away Balancing (Post-Processing)**
   ```typescript
   function balanceHomeAway(matches, teamStates): void {
     for each match:
       currentImbalance = |homeCountA - awayCountA| + |homeCountB - awayCountB|
       swappedImbalance = calculate_after_swap()
       if swappedImbalance < currentImbalance:
         swap(match.teamA, match.teamB)
   ```

### Beispiel-Ergebnis

**Vorher (ohne Fair Scheduler):**
```
Team 1: Pausen [84 min, 12 min] → Ø 48 min
Team 2: Pausen [72 min, 12 min] → Ø 42 min
Team 8: Pausen [24 min, 12 min] → Ø 18 min
Spannweite: 30 min (sehr unfair!)
```

**Nachher (mit Fair Scheduler):**
```
Team 1: Pausen [36 min, 24 min] → Ø 30 min
Team 2: Pausen [36 min, 24 min] → Ø 30 min
Team 8: Pausen [24 min, 36 min] → Ø 30 min
Spannweite: ~6 min (fair!)
```

### Fairness-Analyse

**Funktion:**
```typescript
export function analyzeScheduleFairness(matches: Match[]): FairnessAnalysis
```

**Ausgabe:**
```typescript
interface FairnessAnalysis {
  teamStats: TeamFairnessStats[];  // Pro Team
  global: GlobalFairnessStats;     // Über alle Teams
}

interface TeamFairnessStats {
  teamId: string;
  matchSlots: number[];
  restsInSlots: number[];
  minRest: number;
  maxRest: number;
  avgRest: number;
  restVariance: number;
  fieldDistribution: Map<number, number>;
  homeCount: number;
  awayCount: number;
  homeAwayBalance: number;  // |home - away|
}
```

### Debug-Logging

Aktiviere Browser-Konsole für detaillierte Logs:
```
[FairScheduler] Starting scheduling: {totalPairings: 12, numberOfFields: 1}
[FairScheduler] Slot 0, Field 1: Scheduled Team 1 vs Team 7 (Group A), Score: 10.00, Rest: Infinity/Infinity slots
[FairScheduler] Slot 1, Field 1: Scheduled Team 3 vs Team 5 (Group A), Score: 10.10, Rest: Infinity/Infinity slots
...
```

---

## 📁 Projektstruktur

```
hallenfussball-pwa/
├── src/
│   ├── components/
│   │   ├── ui/                          # Base UI Components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   └── Icons.tsx
│   │   ├── PlayoffParallelConfigurator.tsx  # Playoff Config UI
│   │   └── ScheduleDisplay.tsx          # Schedule Visualization
│   │
│   ├── features/
│   │   └── tournament-creation/
│   │       ├── Step1_SportAndType.tsx
│   │       ├── Step2_ModeAndSystem.tsx
│   │       ├── Step3_Metadata.tsx
│   │       ├── Step4_Teams.tsx
│   │       ├── Step5_Overview.tsx
│   │       └── TournamentPreview.tsx    # Live Preview with Editing
│   │
│   ├── screens/
│   │   └── TournamentCreationScreen.tsx # Main Wizard Container
│   │
│   ├── lib/
│   │   ├── scheduleGenerator.ts         # Time-based Schedule Generation
│   │   └── pdfExporter.ts               # PDF Export (jsPDF)
│   │
│   ├── utils/
│   │   ├── fairScheduler.ts             # ⭐ CORE: Fair Scheduling Algorithm
│   │   ├── playoffScheduler.ts          # Playoff Match Generation
│   │   ├── tournamentScheduler.ts       # Integration Layer
│   │   ├── matchGenerator.ts            # Legacy (deprecated)
│   │   ├── groupHelpers.ts              # Group Utilities
│   │   ├── calculations.ts              # Duration Calculations
│   │   └── storage.ts                   # localStorage Wrapper
│   │
│   ├── hooks/
│   │   ├── useTournaments.ts            # Tournament CRUD Operations
│   │   └── useLocalStorage.ts           # localStorage Hook
│   │
│   ├── types/
│   │   └── tournament.ts                # TypeScript Type Definitions
│   │
│   ├── styles/
│   │   ├── theme.ts                     # Design Tokens
│   │   └── global.css                   # Global Styles
│   │
│   ├── constants/
│   │   ├── tournamentOptions.ts         # Dropdown Options
│   │   └── tournamentSchemas.ts         # Validation Schemas
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── docs/
│   ├── FAIR_SCHEDULER.md                # Detailed Algorithm Documentation
│   └── SCHEDULER_EXAMPLES.md            # Usage Examples
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Wichtige Dateien für KI-Analyse

| Datei | Beschreibung | Priorität |
|-------|-------------|-----------|
| `src/utils/fairScheduler.ts` | Kern-Algorithmus für faire Spielplanung | ⭐⭐⭐ |
| `src/utils/playoffScheduler.ts` | Playoff-Logik mit Parallelisierung | ⭐⭐⭐ |
| `src/lib/scheduleGenerator.ts` | Integration & Zeit-Berechnung | ⭐⭐⭐ |
| `src/types/tournament.ts` | Alle TypeScript-Typen | ⭐⭐ |
| `src/components/PlayoffParallelConfigurator.tsx` | Playoff-Config UI | ⭐⭐ |
| `docs/FAIR_SCHEDULER.md` | Ausführliche Dokumentation | ⭐⭐ |

---

## 🛠️ Tech Stack

### Core
- **React 18** - UI Framework mit Hooks
- **TypeScript 5** - Type Safety & Developer Experience
- **Vite 5** - Fast Build Tool & HMR

### Libraries
- **jsPDF** + **jsPDF-AutoTable** - PDF Generation
- **date-fns** - Date Utilities (optional)

### Persistence
- **localStorage** - Browser-based Data Storage

### Deployment
- **GitHub Pages** - Static Hosting (geplant)

---

## 📦 Verfügbare Scripts

```bash
npm run dev          # Development Server (Port 3001)
npm run build        # Production Build
npm run preview      # Preview Production Build
npm run lint         # ESLint ausführen
```

---

## 📝 Aktueller Status

### ✅ Vollständig Implementiert

#### Fair Scheduler System
- ✅ Round-Robin Pairing Generation (Circle Method)
- ✅ Greedy Scheduling mit Fairness-Heuristik
- ✅ Globale Varianz-Minimierung
- ✅ Priorität: Längste Pause zuerst
- ✅ Home/Away Balancing (Post-Processing)
- ✅ Feld-Verteilung
- ✅ Fairness-Analyse & Reporting

#### Playoff System
- ✅ 2-Gruppen Turniere (Direct Finals)
- ✅ 4-Gruppen Turniere (Semifinals → Finals)
- ✅ Parallelisierungs-Konfiguration
- ✅ Topologische Sortierung (Dependencies)
- ✅ UI für Playoff-Config

#### UI & Features
- ✅ 5-Step Tournament Creation Wizard
- ✅ Live Preview mit editierbarer Playoff-Config
- ✅ PDF Export
- ✅ localStorage Persistence
- ✅ Responsive Design
- ✅ Theme System

#### Tournament Management System (NEU v2.2)
- ✅ Live-Turnierverwaltung mit Tab-Navigation
- ✅ Turnierleitung (Kampfgericht) Tab
- ✅ Match Cockpit für Live-Spielsteuerung
- ✅ Match-Selektor (automatisch oder manuell)
- ✅ Klickbarer Timer mit manueller Zeitanpassung (MM:SS)
- ✅ Dedizierte Pause/Fortsetzen-Funktion
- ✅ Warnungen bei Ergebnis-Überschreibung
- ✅ LiveMatch State Management (localStorage)
- ✅ MatchEvent-System für vollständige Event-Historie
- ✅ Verbesserte Event-Liste mit Emojis und Farbcodierung
- ✅ Automatische Spielprogression
- ✅ Live-Tabellen mit Auto-Update
- ✅ Finale Platzierungsberechnung mit Platzierungslogik-Anzeige
- ✅ Bearbeitbarer Spielplan mit direkter Ergebniseingabe
- ✅ Schiedsrichter-Zuweisung (Organizer + Teams Modus)
- ✅ Multi-Field Support (1-4 Felder)

### 🚧 In Arbeit

- 🔄 Monitor-Ansicht für Publikum (Großbildschirm)
- 🔄 Public View (Zuschauer-Ansicht via Link)

### 📋 Geplant

- 📅 Push Notifications
- 📅 Offline-First PWA
- 📅 Cloud Sync (optional)
- 📅 QR-Code für Live-Tracking

---

## 🎨 Design System

Theme definiert in `src/styles/theme.ts`:

```typescript
export const theme = {
  colors: {
    primary: '#2563eb',      // Blue
    secondary: '#7c3aed',    // Purple
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Orange
    danger: '#ef4444',       // Red
    // ...
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  // ...
}
```

---

## 💾 Datenpersistenz

### localStorage Schema

```typescript
// Key: 'hallenfussball_tournaments'
interface StoredData {
  tournaments: Tournament[];
}

interface Tournament {
  id: string;
  title: string;
  date: string;
  location: string;
  sport: 'football' | 'handball' | 'basketball';
  mode: 'hallenfussball' | 'futsal' | 'normal';
  ageClass: string;
  teams: Team[];
  groupSystem: 'roundRobin' | 'groupsAndFinals';
  numberOfGroups?: number;
  numberOfFields: number;
  finals: Finals;
  playoffConfig?: PlayoffConfig;  // NEW
  minRestSlots?: number;          // NEW
  // ...
}
```

---

## 🔧 Konfiguration

### TypeScript Config
- `tsconfig.json` - App Configuration
- `tsconfig.node.json` - Vite Configuration

### Vite Config
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
```

---

## 📚 Dokumentation

### Für Entwickler
- `docs/FAIR_SCHEDULER.md` - Detaillierte Algorithmus-Dokumentation
- `docs/SCHEDULER_EXAMPLES.md` - Code-Beispiele & Migration

### Für KI-Assistenten
Diese README ist strukturiert für:
- **ChatGPT**: Nutze den GitHub-Link für Code-Analyse
- **Claude**: Direkte Code-Beispiele eingebettet
- **GitHub Copilot**: JSDoc in allen Funktionen

**KI-Prompt-Template:**
```
Analysiere das Hallenfußball PWA Repository:
https://github.com/Stieges/hallenfussball-pwa

Fokus auf:
1. src/utils/fairScheduler.ts - Fair Scheduling Algorithmus
2. src/utils/playoffScheduler.ts - Playoff-Logik
3. src/lib/scheduleGenerator.ts - Zeit-Berechnung

Erkläre die Implementierung der Pausen-Fairness-Optimierung.
```

---

## 🤝 Contributing

### Branch-Strategie
- `main` - Production-ready Code
- Feature-Branches: `feature/xyz`
- Bugfix-Branches: `bugfix/xyz`

### Commit-Konvention
```
<type>: <subject>

<body>

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## 📄 Lizenz

MIT License - siehe `LICENSE` Datei

---

## 👤 Autor

Daniel Stiegler
- GitHub: [@Stieges](https://github.com/Stieges)

---

## 🙏 Acknowledgments

- Fair Scheduler Algorithmus entwickelt mit **Claude Code (Sonnet 4.5)**
- UI Design inspiriert von modernen Sports-Management-Apps
- Circle Method für Round-Robin basiert auf klassischen Scheduling-Algorithmen

---

**Letzte Aktualisierung:** 2025-11-29
**Version:** 2.2.0 (Tournament Management + Erweiterte Pause/Resume-Logik + Event-Liste Verbesserungen)
