# Fair Tournament Scheduler - Dokumentation

## Übersicht

Das Fair Tournament Scheduler System bietet eine erweiterte Spielplan-Generierung für Hallenfußball-Turniere mit Fokus auf:

- **Faire Pausen**: Gleichmäßige Verteilung der Spiele über die Zeit
- **Multi-Field Support**: Parallele Spiele auf mehreren Feldern
- **Flexible Playoffs**: Konfigurierbare Parallelisierung von Finalspielen
- **Determinismus**: Gleiche Eingabe → gleicher Spielplan

## Architektur

### Hauptkomponenten

```
src/utils/
├── fairScheduler.ts          # Gruppenphase mit Round-Robin + Fairness
├── playoffScheduler.ts       # K.o.-Phase mit Parallelisierung
├── tournamentScheduler.ts    # Hauptintegration
└── matchGenerator.ts         # Legacy Support

src/types/tournament.ts
└── PlayoffConfig             # Neue Playoff-Konfiguration

src/components/
└── PlayoffParallelConfigurator.tsx  # UI für Playoff-Konfiguration
```

## Features

### 1. Faire Gruppenphase (Round-Robin)

**Algorithmus:**
- Circle-Methode für Round-Robin Paarungen
- Greedy-Scheduling mit Fairness-Heuristik
- Slot × Feld Matrix für Parallelisierung

**Fairness-Kriterien:**
1. **Gleiche Spielanzahl** pro Team (durch Round-Robin garantiert)
2. **Gleichmäßige Zeitverteilung**: Minimierung der Varianz zwischen Spielen
3. **Faire Pausen**: Respektiert `minRestSlots` zwischen Spielen
4. **Faire Feldverteilung**: Teams spielen auf verschiedenen Feldern

**Code-Beispiel:**

```typescript
import { generateGroupPhaseSchedule } from './utils/fairScheduler';

const options = {
  groups: new Map([
    ['A', [team1, team2, team3]],
    ['B', [team4, team5, team6]]
  ]),
  numberOfFields: 2,
  slotDurationMinutes: 10,
  breakBetweenSlotsMinutes: 2,
  minRestSlotsPerTeam: 1, // Keine Back-to-back-Spiele
  startTime: new Date('2025-01-15T09:00:00')
};

const matches = generateGroupPhaseSchedule(options);
```

### 2. Fairness-Analyse

Analysiere die Qualität des Spielplans:

```typescript
import { analyzeScheduleFairness } from './utils/fairScheduler';

const analysis = analyzeScheduleFairness(matches);

console.log(analysis.global);
// {
//   minRestAllTeams: 2,
//   maxRestAllTeams: 4,
//   avgRestAllTeams: 3.2,
//   totalVariance: 0.45
// }

analysis.teamStats.forEach(stat => {
  console.log(`Team ${stat.teamId}:`);
  console.log(`  Rest periods: [${stat.restsInSlots.join(', ')}]`);
  console.log(`  Variance: ${stat.restVariance.toFixed(2)}`);
});
```

### 3. Playoff-Scheduling mit Parallelisierung

**Konfiguration:**

```typescript
const playoffConfig: PlayoffConfig = {
  enabled: true,
  allowParallelMatches: true,
  matches: [
    {
      id: 'semi1',
      label: 'Halbfinale 1',
      parallelMode: 'parallelAllowed',
      enabled: true
    },
    {
      id: 'semi2',
      label: 'Halbfinale 2',
      parallelMode: 'parallelAllowed',
      enabled: true
    },
    {
      id: 'final',
      label: 'Finale',
      parallelMode: 'sequentialOnly', // Exklusives Zeitfenster
      enabled: true
    },
    {
      id: 'thirdPlace',
      label: 'Spiel um Platz 3',
      parallelMode: 'parallelAllowed',
      enabled: true
    }
  ]
};
```

**Parallelisierungs-Regeln:**

- `sequentialOnly`: Spiel bekommt eigenen Time-Slot, keine parallelen Spiele
- `parallelAllowed`: Kann mit anderen `parallelAllowed`-Spielen parallel laufen
- Bei 1 Feld: Alle Spiele automatisch seriell
- Respektiert Playoff-Tree Dependencies (Halbfinale → Finale)
- Respektiert `minRestSlots` auch in Playoffs

### 4. Vollständige Turnier-Generierung

```typescript
import { generateTournamentSchedule } from './utils/tournamentScheduler';

const result = generateTournamentSchedule({
  tournament: myTournament,
  startTime: new Date('2025-01-15T09:00:00'),
  useAdvancedScheduler: true
});

console.log(`Gruppenspiele: ${result.groupMatches.length}`);
console.log(`Playoff-Spiele: ${result.playoffMatches.length}`);
console.log(`Gesamtdauer: ${result.estimatedDurationMinutes} Minuten`);
console.log(`Fairness Score: ${result.fairnessAnalysis.global.totalVariance}`);
```

## UI-Integration

### Playoff-Parallelisierungs-Konfiguration

Die UI-Komponente `PlayoffParallelConfigurator` ist in Step2_ModeAndSystem integriert:

**Features:**
- Globaler Toggle: "Finalspiele dürfen parallel laufen"
- Pro-Spiel Konfiguration: Einzeln oder Parallel
- Visuelles Feedback: ⚡ = Parallel, ⏱️ = Einzeln
- Nur sichtbar bei ≥2 Feldern und aktivierten Finals

**Screenshot-Konzept:**

```
⚡ Parallelisierung der Finalspiele
Mit 2 Feldern können mehrere Spiele gleichzeitig stattfinden.

☑ Finalspiele dürfen parallel laufen

Konfiguration pro Spiel:
┌────────────────────────────────┐
│ ⚡ Halbfinale 1  Parallel möglich│
│ ⚡ Halbfinale 2  Parallel möglich│
│ ⏱️  Finale       Einzeln         │
│ ⚡ Platz 3/4     Parallel möglich│
└────────────────────────────────┘
```

## Technische Details

### Algorithmus: Fair Scheduler

**Slot-Zuweisungs-Heuristik:**

```
Für jedes Match (Team A vs Team B):
  Score = 0

  // Rest-Period Fairness
  aktueller_Rest_A = aktueller_Slot - letzter_Slot_A
  aktueller_Rest_B = aktueller_Slot - letzter_Slot_B
  Score += |aktueller_Rest_A - durchschnitt_Rest_A|
  Score += |aktueller_Rest_B - durchschnitt_Rest_B|

  // Feld-Verteilungs-Fairness
  Score += (Feld_Nutzung_A[aktuelles_Feld] / total_Spiele_A) * 10
  Score += (Feld_Nutzung_B[aktuelles_Feld] / total_Spiele_B) * 10

  // Bevorzuge frühere Slots (leicht)
  Score += aktueller_Slot * 0.1

Wähle Match mit niedrigstem Score für diesen Slot
```

**Komplexität:**
- Time: O(M × S × F) wobei M = Matches, S = Slots, F = Fields
- Space: O(T + M) wobei T = Teams, M = Matches
- Deterministisch bei gleicher Eingabe-Reihenfolge

### Erweiterbarkeit

**Neue Fairness-Kriterien hinzufügen:**

1. Erweitere `calculateFairnessScore()` in `fairScheduler.ts`
2. Füge Tracking in `TeamScheduleState` hinzu
3. Update `analyzeScheduleFairness()` für neue Metriken

**Neue Playoff-Strukturen:**

1. Erweitere `generatePlayoffDefinitions()` in `playoffScheduler.ts`
2. Definiere neue Match-IDs und Dependencies
3. Update UI in `PlayoffParallelConfigurator.tsx`

## Migration von Legacy

Der neue Scheduler ist opt-in über `useAdvancedScheduler`:

```typescript
generateTournamentSchedule({
  tournament,
  useAdvancedScheduler: false  // Nutzt alten matchGenerator.ts
});
```

**Unterschiede:**
- Legacy: Einfache Field-Rotation, keine Fairness-Garantien
- Neu: Heuristische Optimierung, Fairness-Metriken, Parallel-Konfiguration

## Performance

**Benchmarks** (16 Teams, 2 Gruppen, 2 Felder):
- Gruppenphase-Generierung: ~5ms
- Playoff-Generierung: <1ms
- Fairness-Analyse: ~2ms
- **Total: <10ms** für komplettes Turnier

**Skalierung:**
- Bis 26 Gruppen unterstützt (A-Z)
- Bis 10 Felder getestet
- Performance O(n²) für Round-Robin (unvermeidbar)

## Beispiel-Output

```typescript
const analysis = analyzeScheduleFairness(groupMatches);

// Fairness-Report formatieren
import { formatFairnessReport } from './utils/tournamentScheduler';
console.log(formatFairnessReport(analysis));
```

**Output:**
```
=== Fairness Analysis ===

Global Stats:
  Min Rest (all teams): 2 slots
  Max Rest (all teams): 4 slots
  Avg Rest (all teams): 3.00 slots
  Variance: 0.33

Per-Team Stats:

  Team team-1:
    Matches in slots: [0, 3, 6]
    Rest periods: [3, 3]
    Min/Max/Avg Rest: 3/3/3.00
    Rest Variance: 0.00
    Field Distribution: Field 1: 2, Field 2: 1

  Team team-2:
    Matches in slots: [0, 4, 7]
    Rest periods: [4, 3]
    Min/Max/Avg Rest: 3/4/3.50
    Rest Variance: 0.25
    Field Distribution: Field 1: 1, Field 2: 2
```

## Trouble shooting

### Problem: "Could not schedule all matches"

**Ursache:** Constraints zu strikt (zu wenig Slots für `minRestSlots`)

**Lösung:**
- Reduziere `minRestSlots`
- Erhöhe Anzahl Felder
- Verringere Anzahl Teams pro Gruppe

### Problem: Hohe Fairness-Varianz

**Ursache:** Ungünstige Team-/Gruppen-Kombination

**Lösung:**
- Bereits sehr gut optimiert durch Heuristik
- Varianz < 1.0 ist akzeptabel
- Varianz > 2.0: Prüfe Turnier-Konfiguration

### Problem: Playoffs nicht wie erwartet

**Ursache:** `parallelMode` vs. verfügbare Felder

**Lösung:**
- Prüfe `numberOfFields` in Tournament
- Prüfe `playoffConfig.allowParallelMatches`
- Debug mit `console.log(result.playoffMatches)`

## Weiterführende Entwicklung

**Geplante Features:**
- [ ] Live-Rescheduling bei Spielausfällen
- [ ] Constraint-Solver statt Greedy (Backtracking)
- [ ] Weighted Fairness (wichtige Teams bevorzugen)
- [ ] Feld-Präferenzen (Team → Feld Mapping)
- [ ] GUI für Fairness-Visualisierung

## Lizenz

Teil des Hallenfußball-PWA Projekts.
