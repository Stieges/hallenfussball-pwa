# Fair Scheduler - Usage Examples

## Beispiel 1: Einfaches 2-Gruppen-Turnier mit Fairness

```typescript
import { generateTournamentSchedule } from './utils/tournamentScheduler';
import { Tournament, Team } from './types/tournament';

// Teams erstellen
const teams: Team[] = [
  { id: 'team-1', name: 'FC Bayern', group: 'A' },
  { id: 'team-2', name: 'BVB', group: 'A' },
  { id: 'team-3', name: 'RB Leipzig', group: 'A' },
  { id: 'team-4', name: 'Leverkusen', group: 'B' },
  { id: 'team-5', name: 'Frankfurt', group: 'B' },
  { id: 'team-6', name: 'Wolfsburg', group: 'B' },
];

// Turnier-Konfiguration
const tournament: Tournament = {
  id: 'tournament-1',
  status: 'draft',
  sport: 'football',
  tournamentType: 'classic',
  mode: 'classic',

  // Multi-Field Setup
  numberOfFields: 2,
  numberOfTeams: 6,

  // Gruppen-Setup
  groupSystem: 'groupsAndFinals',
  numberOfGroups: 2,

  // Zeitkonfiguration
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  finalRoundGameDuration: 12,
  finalRoundBreakDuration: 3,
  breakBetweenPhases: 5,

  // Fairness
  minRestSlots: 1, // Mindestens 1 Slot Pause zwischen Spielen

  // Finals
  finals: {
    final: true,
    thirdPlace: true,
    fifthSixth: false,
    seventhEighth: false,
  },

  // Playoff-Konfiguration mit Parallelisierung
  playoffConfig: {
    enabled: true,
    allowParallelMatches: true,
    matches: [
      {
        id: 'final',
        label: 'Finale',
        parallelMode: 'sequentialOnly', // Finale alleine
        enabled: true,
      },
      {
        id: 'thirdPlace',
        label: 'Spiel um Platz 3',
        parallelMode: 'parallelAllowed', // Kann parallel laufen
        enabled: true,
      }
    ],
  },

  // Rest der Konfiguration
  title: 'Hallenturnier 2025',
  ageClass: 'U11',
  date: '2025-01-15',
  timeSlot: '09:00 - 16:00',
  location: 'Sporthalle Muster',
  teams,
  placementLogic: [],
  isKidsTournament: false,
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  resultMode: 'goals',
  pointSystem: { win: 3, draw: 1, loss: 0 },
  matches: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Spielplan generieren
const result = generateTournamentSchedule({
  tournament,
  startTime: new Date('2025-01-15T09:00:00'),
  useAdvancedScheduler: true,
});

// Ergebnis auswerten
console.log('=== Turnier-Spielplan ===');
console.log(`Gruppenspiele: ${result.groupMatches.length}`);
console.log(`Playoff-Spiele: ${result.playoffMatches.length}`);
console.log(`Gesamtdauer: ${result.estimatedDurationMinutes} Minuten`);
console.log(`Anzahl Slots: ${result.totalSlots}`);

// Fairness-Analyse
const { global, teamStats } = result.fairnessAnalysis;
console.log('\n=== Fairness ===');
console.log(`Globale Varianz: ${global.totalVariance.toFixed(2)}`);
console.log(`Durchschnittliche Pause: ${global.avgRestAllTeams.toFixed(1)} Slots`);

// Details pro Team
teamStats.forEach(stat => {
  console.log(`\nTeam ${stat.teamId}:`);
  console.log(`  Spiele in Slots: [${stat.matchSlots.join(', ')}]`);
  console.log(`  Pausen: [${stat.restsInSlots.join(', ')}] Slots`);
  console.log(`  Min/Max/Avg: ${stat.minRest}/${stat.maxRest}/${stat.avgRest.toFixed(1)}`);
});

// Spielplan ausgeben
console.log('\n=== Spielplan ===');
result.allMatches.forEach(match => {
  const time = match.scheduledTime?.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  }) || 'N/A';

  const phase = match.isFinal ? `FINAL (${match.finalType})` : `Gruppe ${match.group}`;

  console.log(
    `${time} | Feld ${match.field} | Slot ${match.slot} | ` +
    `${phase} | ${match.teamA} vs ${match.teamB}`
  );
});
```

## Beispiel 2: Nur Gruppenphase ohne Finals

```typescript
const tournament: Tournament = {
  // ... Basis-Konfiguration wie oben

  groupSystem: 'roundRobin', // Alle gegen alle, keine Gruppen
  numberOfFields: 3, // 3 parallele Felder

  finals: {
    final: false,
    thirdPlace: false,
    fifthSixth: false,
    seventhEighth: false,
  },

  minRestSlots: 2, // Mehr Pause zwischen Spielen

  teams: [
    { id: 'team-1', name: 'Team 1' }, // Keine Gruppen
    { id: 'team-2', name: 'Team 2' },
    { id: 'team-3', name: 'Team 3' },
    { id: 'team-4', name: 'Team 4' },
    { id: 'team-5', name: 'Team 5' },
    { id: 'team-6', name: 'Team 6' },
  ],

  // Rest...
};

const result = generateTournamentSchedule({
  tournament,
  startTime: new Date('2025-01-15T09:00:00'),
  useAdvancedScheduler: true,
});

// Nur Gruppenspiele
console.log(`Generiert: ${result.groupMatches.length} Gruppenspiele`);
console.log(`Keine Playoffs: ${result.playoffMatches.length === 0}`);
```

## Beispiel 3: 4-Gruppen-Turnier mit Halbfinale

```typescript
const tournament: Tournament = {
  // ... Basis-Konfiguration

  numberOfFields: 2,
  numberOfGroups: 4, // 4 Gruppen A, B, C, D

  teams: [
    // Gruppe A
    { id: 'team-1', name: 'A1', group: 'A' },
    { id: 'team-2', name: 'A2', group: 'A' },
    { id: 'team-3', name: 'A3', group: 'A' },

    // Gruppe B
    { id: 'team-4', name: 'B1', group: 'B' },
    { id: 'team-5', name: 'B2', group: 'B' },
    { id: 'team-6', name: 'B3', group: 'B' },

    // Gruppe C
    { id: 'team-7', name: 'C1', group: 'C' },
    { id: 'team-8', name: 'C2', group: 'C' },
    { id: 'team-9', name: 'C3', group: 'C' },

    // Gruppe D
    { id: 'team-10', name: 'D1', group: 'D' },
    { id: 'team-11', name: 'D2', group: 'D' },
    { id: 'team-12', name: 'D3', group: 'D' },
  ],

  finals: {
    final: true,
    thirdPlace: true,
    fifthSixth: false,
    seventhEighth: false,
  },

  // Playoff mit Halbfinale-Parallelisierung
  playoffConfig: {
    enabled: true,
    allowParallelMatches: true,
    matches: [
      {
        id: 'semi1',
        label: 'Halbfinale 1',
        parallelMode: 'parallelAllowed', // HF1 und HF2 parallel
        enabled: true,
      },
      {
        id: 'semi2',
        label: 'Halbfinale 2',
        parallelMode: 'parallelAllowed',
        enabled: true,
      },
      {
        id: 'final',
        label: 'Finale',
        parallelMode: 'sequentialOnly', // Finale alleine
        enabled: true,
      },
      {
        id: 'thirdPlace',
        label: 'Spiel um Platz 3',
        parallelMode: 'parallelAllowed', // Kann mit anderem parallel
        enabled: true,
      }
    ],
  },

  // Rest...
};

const result = generateTournamentSchedule({
  tournament,
  startTime: new Date('2025-01-15T09:00:00'),
  useAdvancedScheduler: true,
});

// Playoff-Struktur analysieren
const playoffs = result.playoffMatches;
console.log('\n=== Playoff-Struktur ===');

const semis = playoffs.filter(m => m.id.includes('semi'));
const final = playoffs.find(m => m.finalType === 'final');
const thirdPlace = playoffs.find(m => m.finalType === 'thirdPlace');

console.log(`Halbfinale in Slot ${semis[0]?.slot} (parallel: ${semis.length === 2 && semis[0].slot === semis[1].slot})`);
console.log(`Finale in Slot ${final?.slot}`);
console.log(`Platz 3 in Slot ${thirdPlace?.slot} (mit Finale parallel: ${thirdPlace?.slot === final?.slot})`);
```

## Beispiel 4: Custom Fairness-Analyse

```typescript
import { analyzeScheduleFairness, formatFairnessReport } from './utils/fairScheduler';

// Nach der Generierung
const result = generateTournamentSchedule({ tournament, startTime, useAdvancedScheduler: true });

// Detaillierte Fairness-Analyse
const analysis = analyzeScheduleFairness(result.groupMatches);

// Finde Teams mit unfairer Verteilung
const unfairTeams = analysis.teamStats.filter(stat => {
  const restVariance = stat.restVariance;
  const fieldImbalance = calculateFieldImbalance(stat.fieldDistribution);

  return restVariance > 1.0 || fieldImbalance > 0.5;
});

if (unfairTeams.length > 0) {
  console.warn('⚠️ Teams mit suboptimaler Fairness:');
  unfairTeams.forEach(stat => {
    console.log(`  ${stat.teamId}: Varianz ${stat.restVariance.toFixed(2)}`);
  });
} else {
  console.log('✅ Alle Teams haben faire Spielverteilung');
}

// Helper: Berechne Feld-Ungleichgewicht
function calculateFieldImbalance(fieldDist: Map<number, number>): number {
  const counts = Array.from(fieldDist.values());
  if (counts.length === 0) return 0;

  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;

  return Math.sqrt(variance);
}

// Formatierter Report
console.log(formatFairnessReport(analysis));
```

## Beispiel 5: Migration vom Legacy Scheduler

```typescript
// Alt: Legacy Scheduler (src/utils/matchGenerator.ts)
import { generateMatches } from './utils/matchGenerator';

const legacyMatches = generateMatches(tournament);
// - Einfache Feld-Rotation
// - Keine Fairness-Garantien
// - Keine Playoff-Parallelisierung

// Neu: Fair Scheduler
import { generateTournamentSchedule } from './utils/tournamentScheduler';

const newResult = generateTournamentSchedule({
  tournament,
  startTime: new Date('2025-01-15T09:00:00'),
  useAdvancedScheduler: true, // TRUE = Fair Scheduler
});

// Vergleich
console.log('Legacy Matches:', legacyMatches.length);
console.log('New Matches:', newResult.allMatches.length);
console.log('Fairness Score:', newResult.fairnessAnalysis.global.totalVariance);

// Schrittweise Migration: Opt-in mit Flag
const migrationResult = generateTournamentSchedule({
  tournament,
  startTime: new Date('2025-01-15T09:00:00'),
  useAdvancedScheduler: false, // FALSE = Legacy Support
});
// Nutzt intern matchGenerator.ts
```

## Beispiel 6: Interaktive Fairness-Optimierung

```typescript
// Iteriere über verschiedene Konfigurationen
const configurations = [
  { minRestSlots: 1, numberOfFields: 2 },
  { minRestSlots: 2, numberOfFields: 2 },
  { minRestSlots: 1, numberOfFields: 3 },
  { minRestSlots: 2, numberOfFields: 3 },
];

const results = configurations.map(config => {
  const testTournament = { ...tournament, ...config };

  const result = generateTournamentSchedule({
    tournament: testTournament,
    startTime: new Date('2025-01-15T09:00:00'),
    useAdvancedScheduler: true,
  });

  return {
    config,
    variance: result.fairnessAnalysis.global.totalVariance,
    duration: result.estimatedDurationMinutes,
    slots: result.totalSlots,
  };
});

// Finde beste Konfiguration (niedrigste Varianz bei akzeptabler Dauer)
const best = results.reduce((best, current) => {
  if (current.duration > 240) return best; // Max 4 Stunden

  return current.variance < best.variance ? current : best;
});

console.log('🏆 Beste Konfiguration:');
console.log(best.config);
console.log(`Varianz: ${best.variance.toFixed(2)}`);
console.log(`Dauer: ${best.duration} Minuten`);
```

## Best Practices

### ✅ DO

- Nutze `minRestSlots >= 1` für faire Pausen
- Nutze `useAdvancedScheduler: true` für neue Turniere
- Analysiere Fairness mit `analyzeScheduleFairness()`
- Setze `parallelMode: 'sequentialOnly'` für wichtige Finals
- Teste verschiedene Feld-Anzahlen für optimale Fairness

### ❌ DON'T

- Nicht `minRestSlots: 0` verwenden (Back-to-back Spiele)
- Nicht mehr Gruppen als Teams verwenden
- Nicht `parallelMode: 'parallelAllowed'` für alle Finals (Finale sollte exklusiv sein)
- Nicht unnötig viele Felder (>10) konfigurieren

### 💡 TIPS

- Starte mit Default-Werten und iteriere
- Prüfe Fairness-Varianz: <0.5 = excellent, <1.0 = good, >2.0 = review
- Nutze formatFairnessReport() für Debugging
- Bei Problemen: Erst minRestSlots reduzieren, dann Felder erhöhen
