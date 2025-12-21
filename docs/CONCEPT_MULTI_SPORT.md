# Konzept: Multi-Sport-Unterstützung

## Übersicht

Erweiterung des Turnierplaners zur Unterstützung verschiedener Sportarten mit sportspezifischen Regeln, Terminologie und Standardwerten.

---

## Architektur

### SportConfig System

```
src/
├── config/
│   └── sports/
│       ├── index.ts              # Registry & Exports
│       ├── types.ts              # SportConfig Interface
│       ├── football.ts           # Fußball (Halle + Feld)
│       ├── handball.ts           # Handball
│       ├── basketball.ts         # Basketball
│       ├── volleyball.ts         # Volleyball
│       ├── floorball.ts          # Floorball/Unihockey
│       ├── hockey.ts             # Hockey (Feld + Halle)
│       └── custom.ts             # Benutzerdefiniert
```

---

## Core Interface: SportConfig

```typescript
// src/config/sports/types.ts

export type SportId =
  | 'football-indoor'    // Hallenfußball
  | 'football-outdoor'   // Feldfußball
  | 'handball'
  | 'basketball'
  | 'volleyball'
  | 'floorball'
  | 'hockey-indoor'
  | 'hockey-outdoor'
  | 'custom';

export interface SportConfig {
  /** Eindeutige ID */
  id: SportId;

  /** Anzeigename */
  name: string;

  /** Icon (Emoji oder Icon-Name) */
  icon: string;

  /** Kategorie für Gruppierung */
  category: 'ball' | 'team' | 'individual' | 'other';

  /** Terminologie */
  terminology: SportTerminology;

  /** Standardwerte */
  defaults: SportDefaults;

  /** Spielregeln */
  rules: SportRules;

  /** Altersklassen */
  ageClasses: AgeClassOption[];

  /** Verfügbare Features */
  features: SportFeatures;

  /** Validierungsregeln */
  validation: SportValidation;
}

export interface SportTerminology {
  /** "Feld" vs "Court" vs "Spielfläche" */
  field: string;
  fieldPlural: string;

  /** "Tor" vs "Korb" vs "Punkt" */
  goal: string;
  goalPlural: string;

  /** "Halbzeit" vs "Viertel" vs "Satz" */
  period: string;
  periodPlural: string;

  /** "Spiel" vs "Match" vs "Partie" */
  match: string;
  matchPlural: string;

  /** "Mannschaft" vs "Team" */
  team: string;
  teamPlural: string;

  /** "Schiedsrichter" vs "Referee" */
  referee: string;
  refereePlural: string;

  /** Ergebnis-Bezeichnung: "3:2" vs "25:21, 19:25, 15:12" */
  scoreFormat: 'goals' | 'sets' | 'points';

  /** "Sieg" / "Niederlage" / "Unentschieden" */
  win: string;
  loss: string;
  draw: string;
}

export interface SportDefaults {
  /** Spieldauer in Minuten */
  gameDuration: number;

  /** Pause zwischen Spielen in Minuten */
  breakDuration: number;

  /** Anzahl Spielabschnitte (1, 2, 4, etc.) */
  periods: number;

  /** Pause zwischen Abschnitten */
  periodBreak: number;

  /** Standard-Punktesystem */
  pointSystem: {
    win: number;
    draw: number;
    loss: number;
  };

  /** Erlaubt Unentschieden? */
  allowDraw: boolean;

  /** Typische Team-Größe (für Infos) */
  typicalTeamSize: number;

  /** Typische Anzahl Felder */
  typicalFieldCount: number;

  /** Empfohlene min. Pause zwischen eigenen Spielen (in Slots) */
  minRestSlots: number;
}

export interface SportRules {
  /** Kann unentschieden enden? */
  canDrawInGroupPhase: boolean;
  canDrawInFinals: boolean;

  /** Verlängerung in Finals? */
  hasOvertime: boolean;
  overtimeDuration?: number;

  /** Penaltys/Shootout bei Unentschieden in Finals? */
  hasShootout: boolean;

  /** Satzbasiert (Volleyball)? */
  isSetBased: boolean;
  setsToWin?: number;

  /** Punktelimit pro Satz (Volleyball: 25, Tiebreak: 15) */
  pointsPerSet?: number;

  /** Timeout-Regeln */
  timeoutsPerTeam?: number;
  timeoutDuration?: number;
}

export interface SportFeatures {
  /** DFB-Schlüsselzahlen verfügbar */
  hasDFBKeys: boolean;

  /** Bambini-Modus sinnvoll */
  hasBambiniMode: boolean;

  /** Schiedsrichter-Zuweisung */
  hasRefereeAssignment: boolean;

  /** Tor-Animation */
  hasGoalAnimation: boolean;

  /** Live-Timer relevant */
  hasMatchTimer: boolean;

  /** Halbzeitpause-Timer */
  hasHalftimeTimer: boolean;
}

export interface SportValidation {
  /** Min/Max Teams */
  minTeams: number;
  maxTeams: number;

  /** Min/Max Felder */
  minFields: number;
  maxFields: number;

  /** Min/Max Spieldauer */
  minGameDuration: number;
  maxGameDuration: number;

  /** Warnungen */
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  condition: (config: TournamentConfig) => boolean;
  message: string;
  suggestion?: string;
}

export interface AgeClassOption {
  value: string;
  label: string;
  minAge?: number;
  maxAge?: number;
}
```

---

## Beispiel-Konfigurationen

### Hallenfußball (aktuell)

```typescript
// src/config/sports/football.ts

export const footballIndoorConfig: SportConfig = {
  id: 'football-indoor',
  name: 'Hallenfußball',
  icon: '⚽',
  category: 'ball',

  terminology: {
    field: 'Feld',
    fieldPlural: 'Felder',
    goal: 'Tor',
    goalPlural: 'Tore',
    period: 'Halbzeit',
    periodPlural: 'Halbzeiten',
    match: 'Spiel',
    matchPlural: 'Spiele',
    team: 'Mannschaft',
    teamPlural: 'Mannschaften',
    referee: 'Schiedsrichter',
    refereePlural: 'Schiedsrichter',
    scoreFormat: 'goals',
    win: 'Sieg',
    loss: 'Niederlage',
    draw: 'Unentschieden',
  },

  defaults: {
    gameDuration: 10,
    breakDuration: 2,
    periods: 1,
    periodBreak: 0,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    allowDraw: true,
    typicalTeamSize: 6,
    typicalFieldCount: 1,
    minRestSlots: 1,
  },

  rules: {
    canDrawInGroupPhase: true,
    canDrawInFinals: false,
    hasOvertime: false,
    hasShootout: true,
    isSetBased: false,
  },

  features: {
    hasDFBKeys: true,
    hasBambiniMode: true,
    hasRefereeAssignment: true,
    hasGoalAnimation: true,
    hasMatchTimer: true,
    hasHalftimeTimer: true,
  },

  ageClasses: [
    { value: 'G-Jugend', label: 'G-Jugend (U7)', minAge: 5, maxAge: 7 },
    { value: 'F-Jugend', label: 'F-Jugend (U9)', minAge: 7, maxAge: 9 },
    // ... weitere
  ],

  validation: {
    minTeams: 2,
    maxTeams: 64,
    minFields: 1,
    maxFields: 10,
    minGameDuration: 5,
    maxGameDuration: 30,
    warnings: [
      {
        condition: (c) => c.teams > 8 && c.fields === 1,
        message: 'Viele Teams auf nur einem Feld',
        suggestion: 'Erhöhe die Feldanzahl für kürzere Turnierdauer',
      },
    ],
  },
};
```

### Basketball

```typescript
export const basketballConfig: SportConfig = {
  id: 'basketball',
  name: 'Basketball',
  icon: '🏀',
  category: 'ball',

  terminology: {
    field: 'Court',
    fieldPlural: 'Courts',
    goal: 'Korb',
    goalPlural: 'Körbe',
    period: 'Viertel',
    periodPlural: 'Viertel',
    match: 'Spiel',
    matchPlural: 'Spiele',
    team: 'Team',
    teamPlural: 'Teams',
    referee: 'Referee',
    refereePlural: 'Referees',
    scoreFormat: 'points',
    win: 'Sieg',
    loss: 'Niederlage',
    draw: 'Unentschieden',
  },

  defaults: {
    gameDuration: 20,        // 4x5 Minuten typisch bei Turnieren
    breakDuration: 3,
    periods: 4,
    periodBreak: 1,
    pointSystem: { win: 2, draw: 0, loss: 1 }, // Basketball: kein Unentschieden
    allowDraw: false,
    typicalTeamSize: 5,
    typicalFieldCount: 1,
    minRestSlots: 2,
  },

  rules: {
    canDrawInGroupPhase: false,  // Bei Gleichstand: Verlängerung
    canDrawInFinals: false,
    hasOvertime: true,
    overtimeDuration: 3,
    hasShootout: false,
    isSetBased: false,
  },

  features: {
    hasDFBKeys: false,
    hasBambiniMode: true,
    hasRefereeAssignment: true,
    hasGoalAnimation: true,      // Könnte "Korb-Animation" werden
    hasMatchTimer: true,
    hasHalftimeTimer: true,
  },

  ageClasses: [
    { value: 'U10', label: 'U10 Mini' },
    { value: 'U12', label: 'U12' },
    { value: 'U14', label: 'U14' },
    { value: 'U16', label: 'U16' },
    { value: 'U18', label: 'U18' },
    { value: 'Herren', label: 'Herren' },
    { value: 'Damen', label: 'Damen' },
  ],

  validation: {
    minTeams: 2,
    maxTeams: 32,
    minFields: 1,
    maxFields: 4,
    minGameDuration: 8,
    maxGameDuration: 48,
    warnings: [],
  },
};
```

### Volleyball

```typescript
export const volleyballConfig: SportConfig = {
  id: 'volleyball',
  name: 'Volleyball',
  icon: '🏐',
  category: 'ball',

  terminology: {
    field: 'Feld',
    fieldPlural: 'Felder',
    goal: 'Punkt',
    goalPlural: 'Punkte',
    period: 'Satz',
    periodPlural: 'Sätze',
    match: 'Spiel',
    matchPlural: 'Spiele',
    team: 'Team',
    teamPlural: 'Teams',
    referee: 'Schiedsrichter',
    refereePlural: 'Schiedsrichter',
    scoreFormat: 'sets',     // Spezial: Satz-Ergebnisse
    win: 'Sieg',
    loss: 'Niederlage',
    draw: 'Unentschieden',   // Nicht möglich
  },

  defaults: {
    gameDuration: 25,        // Ca. Zeitschätzung für 2-Satz-Match
    breakDuration: 5,
    periods: 2,              // Best of 3 (2 Gewinnsätze)
    periodBreak: 2,
    pointSystem: { win: 3, draw: 0, loss: 0 }, // 3:0 oder 3:1 Punkte
    allowDraw: false,
    typicalTeamSize: 6,
    typicalFieldCount: 1,
    minRestSlots: 2,
  },

  rules: {
    canDrawInGroupPhase: false,
    canDrawInFinals: false,
    hasOvertime: false,
    hasShootout: false,
    isSetBased: true,
    setsToWin: 2,            // Best of 3
    pointsPerSet: 25,        // 25 Punkte pro Satz (Tiebreak: 15)
  },

  features: {
    hasDFBKeys: false,
    hasBambiniMode: false,
    hasRefereeAssignment: true,
    hasGoalAnimation: false,  // Kein Tor-Animation bei Volleyball
    hasMatchTimer: false,     // Volleyball hat keine feste Spielzeit
    hasHalftimeTimer: false,
  },

  validation: {
    minTeams: 2,
    maxTeams: 24,
    minFields: 1,
    maxFields: 6,
    minGameDuration: 15,
    maxGameDuration: 60,
    warnings: [],
  },
};
```

---

## Integration in Tournament-Typen

### Erweiterte Tournament-Type

```typescript
// src/types/tournament.ts

// NEU: SportId statt generischem Sport
export type Sport = SportId | 'custom';

export interface Tournament {
  id: string;

  // NEU: Sport-Konfiguration
  sportId: SportId;

  // Optional: Custom-Overrides für Terminologie
  customTerminology?: Partial<SportTerminology>;

  // ... Rest bleibt gleich
}
```

### Sport-Context Hook

```typescript
// src/hooks/useSportConfig.ts

export function useSportConfig(sportId: SportId): SportConfig {
  return useMemo(() => getSportConfig(sportId), [sportId]);
}

// Verwendung in Komponenten:
const { terminology, defaults, features } = useSportConfig(tournament.sportId);

// Dynamische Labels:
<label>{terminology.fieldPlural}</label>
<span>{terminology.goal}</span>
```

---

## UI-Anpassungen

### Step 1: Sportart-Auswahl (erweitert)

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 Sportart auswählen                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚽ FUSSBALL            🏀 BASKETBALL        🏐 VOLLEYBALL  │
│  ├─ Halle              ├─ Indoor            ├─ Indoor      │
│  └─ Feld               └─ Streetball        └─ Beach       │
│                                                             │
│  🤾 HANDBALL            🏒 FLOORBALL         🏑 HOCKEY      │
│  ├─ Halle              └─ Unihockey         ├─ Feld        │
│  └─ Beach                                   └─ Halle       │
│                                                             │
│  🎯 BENUTZERDEFINIERT                                       │
│  └─ Eigene Regeln & Terminologie                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Dynamische Labels (Beispiele)

| Kontext | Fußball | Basketball | Volleyball |
|---------|---------|------------|------------|
| Feldanzahl | "Anzahl Felder" | "Anzahl Courts" | "Anzahl Felder" |
| Ergebnis | "3 : 2" | "78 : 65" | "2:1 (25:21, 19:25, 15:12)" |
| Tor-Animation | "TOR!" | "KORB!" | (keine) |
| Pausenbez. | "Halbzeit" | "Viertelpause" | "Satzpause" |

### Bedingte UI-Elemente

```tsx
// Beispiel: Nur bei Fußball DFB-Keys anzeigen
{features.hasDFBKeys && (
  <DFBKeySystem formData={formData} onUpdate={onUpdate} />
)}

// Beispiel: Satz-basierte Ergebnis-Eingabe
{rules.isSetBased ? (
  <SetScoreInput match={match} setsToWin={rules.setsToWin} />
) : (
  <GoalScoreInput match={match} />
)}

// Beispiel: Dynamische Terminologie
<NumberStepper
  label={`Anzahl ${terminology.fieldPlural}`}
  value={formData.numberOfFields}
/>
```

---

## Migration

### Phase 1: Vorbereitung
1. `SportConfig` Interface erstellen
2. `football-indoor` als erste Konfiguration
3. `useSportConfig` Hook implementieren
4. Bestehende Turniere migrieren: `sport: 'football'` → `sportId: 'football-indoor'`

### Phase 2: Terminologie
1. Alle hardcodierten Begriffe identifizieren (Grep nach "Feld", "Tor", etc.)
2. `terminology` aus Config verwenden
3. Tests für verschiedene Sportarten

### Phase 3: Weitere Sportarten
1. Basketball-Konfiguration
2. Handball-Konfiguration
3. Volleyball-Konfiguration (Satz-basiert)
4. Custom-Sport (Benutzer kann alles definieren)

### Phase 4: Erweiterte Features
1. Satz-basierte Ergebniseingabe
2. Overtime/Verlängerung
3. Sport-spezifische Animationen
4. Sport-spezifische PDF-Vorlagen

---

## Betroffene Dateien

### Zu erstellen
- `src/config/sports/types.ts`
- `src/config/sports/index.ts`
- `src/config/sports/football.ts`
- `src/config/sports/basketball.ts`
- `src/config/sports/handball.ts`
- `src/config/sports/volleyball.ts`
- `src/config/sports/custom.ts`
- `src/hooks/useSportConfig.ts`

### Anzupassen
| Datei | Änderung |
|-------|----------|
| `src/types/tournament.ts` | `Sport` → `SportId`, neues Feld `sportId` |
| `src/constants/tournamentOptions.ts` | Sport-spezifische Defaults auslagern |
| `src/features/tournament-creation/Step1_SportAndType.tsx` | Erweiterte Sportauswahl |
| `src/features/tournament-creation/Step2_ModeAndSystem.tsx` | Dynamische Labels |
| `src/features/tournament-creation/components/*.tsx` | Terminologie aus Config |
| `src/components/match-cockpit/*.tsx` | Dynamische Tor/Punkt-Animation |
| `src/components/monitor/*.tsx` | Sport-spezifische Anzeige |
| `src/utils/scheduleGenerator.ts` | Sport-spezifische Validierung |

---

## Offene Fragen

1. **Satz-basierte Sportarten**: Wie Ergebnisse speichern?
   - Option A: `scoreA/scoreB` als Sätze, separate Feld für Punktestand
   - Option B: Neues Feld `setScores: [{home: 25, away: 21}, ...]`

2. **Verlängerung**: Wie in Finals handhaben?
   - Automatisch starten?
   - Manuell aktivieren?

3. **Custom Sport**: Wie viel Flexibilität?
   - Nur Defaults änderbar?
   - Auch Regeln?

4. **Rückwärtskompatibilität**:
   - Migration bestehender Turniere?
   - Fallback für `sport: 'football'` auf `sportId: 'football-indoor'`?

---

## Empfehlung

**Starte mit Phase 1+2** (ca. 2-3 Tage):
1. Interface + Football-Config erstellen
2. Hook + grundlegende Integration
3. Dynamische Terminologie für bestehende UI

Dann iterativ weitere Sportarten hinzufügen.
