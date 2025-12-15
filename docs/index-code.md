# Code-Kontext: fairScheduler.ts und Umgebung

> **Erstellt:** 2025-12-04
> **Zweck:** Klärung der Code-Zusammenhänge für adesso Agent Plan-Review
> **Basis:** Systematische Analyse des tatsächlichen Codes

---

## 📋 Zusammenfassung

Dieses Dokument beantwortet alle 8 Rückfragen des adesso Agents und klärt Missverständnisse zwischen dem Implementierungsplan und dem tatsächlichen Code.

---

## ✅ Antworten auf die 8 Rückfragen

### 1. Woher kommt `minRestSlotsPerTeam`?

**ANTWORT:** Existiert bereits als Feld in `GroupPhaseScheduleOptions`

**Beweis:**
```typescript
// src/utils/fairScheduler.ts (Line 37-44)
export interface GroupPhaseScheduleOptions {
  groups: Map<string, Team[]>;
  numberOfFields: number;
  slotDurationMinutes: number;
  breakBetweenSlotsMinutes: number;
  minRestSlotsPerTeam: number; // ← EXISTIERT BEREITS!
  startTime?: Date;
}
```

**Verwendung im Code:**
```typescript
// src/lib/scheduleGenerator.ts (Line 155-162)
groupStageMatches = generateGroupPhaseSchedule({
  groups: groupsMap,
  numberOfFields: tournament.numberOfFields,
  slotDurationMinutes: tournament.groupPhaseGameDuration,
  breakBetweenSlotsMinutes: tournament.groupPhaseBreakDuration || 0,
  minRestSlotsPerTeam: tournament.minRestSlots || 1, // ← Wird übergeben
  startTime,
});
```

**Fazit:** ✅ KEIN neues Feld nötig. Plan kann direkt auf dieses Feld zugreifen.

---

### 2. Wie sieht das aktuelle `TeamScheduleState`-Interface aus?

**ANTWORT:** Existiert bereits, ist aber NICHT exportiert

**Vollständige Definition:**
```typescript
// src/utils/fairScheduler.ts (Line 25-32)
interface TeamScheduleState {
  teamId: string;
  matchSlots: number[];              // ← Array der zugewiesenen Slots
  fieldCounts: Map<number, number>;  // ← Feld-Häufigkeiten
  lastSlot: number;                  // ← Letzter Slot (für Rest-Berechnung)
  homeCount: number;                 // ← Home-Position Counter
  awayCount: number;                 // ← Away-Position Counter
}
```

**Problem:** Interface ist NICHT exportiert → FairnessCalculator.ts kann es nicht importieren

**Lösung:**
```typescript
// Option A: Export hinzufügen
export interface TeamScheduleState { ... }

// Option B: FairnessCalculator.ts definiert eigenes Interface (nicht empfohlen)
```

**Empfehlung:** Export hinzufügen in fairScheduler.ts (Line 25)

---

### 3. Gibt es bereits eine `initializeTeamStates`-Hilfsfunktion?

**ANTWORT:** ✅ JA, existiert bereits!

**Vollständiger Code:**
```typescript
// src/utils/fairScheduler.ts (Line 126-141)
function initializeTeamStates(teams: Team[]): Map<string, TeamScheduleState> {
  const states = new Map<string, TeamScheduleState>();
  for (const team of teams) {
    states.set(team.id, {
      teamId: team.id,
      matchSlots: [],
      fieldCounts: new Map(),
      lastSlot: -Infinity,
      homeCount: 0,
      awayCount: 0,
    });
  }
  return states;
}
```

**Verwendung im Code:**
```typescript
// src/utils/fairScheduler.ts (Line 287)
const teamStates = initializeTeamStates(allTeams);
```

**Fazit:** ✅ KEINE neue Funktion nötig. Plan kann diese Funktion nutzen.

---

### 4. Welches Test-Framework wird im Projekt aktuell verwendet?

**ANTWORT:** ❌ KEINES!

**Beweis:**
```json
// package.json (Line 6-11)
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
}
// ← Kein "test" Script
```

```json
// package.json devDependencies (Line 18-29)
"devDependencies": {
  "@types/react": "^18.2.43",
  "@types/react-dom": "^18.2.17",
  "@typescript-eslint/eslint-plugin": "^6.14.0",
  "@typescript-eslint/parser": "^6.14.0",
  "@vitejs/plugin-react": "^4.2.1",
  "eslint": "^8.55.0",
  "eslint-plugin-react-hooks": "^4.6.0",
  "eslint-plugin-react-refresh": "^0.4.5",
  "typescript": "^5.2.2",
  "vite": "^5.0.8"
}
// ← Kein Jest, kein Vitest, kein Mocha
```

**Fazit:** ✅ Vitest kann SICHER hinzugefügt werden (keine Konflikte)

---

### 5. Wie wird das Ergebnis des Schedulers im Frontend verwendet?

**ANTWORT:** Erwartet einfaches `Match[]` Array

**Verwendung im Code:**
```typescript
// src/lib/scheduleGenerator.ts (Line 155-162)
groupStageMatches = generateGroupPhaseSchedule({
  // ... options
});
// ← groupStageMatches ist Match[]

// Später im Code:
return {
  groupStage: groupStageMatches,  // ← Direkt als Match[] verwendet
  playoff: playoffMatches,
  allMatches: [...groupStageMatches, ...playoffMatches],
};
```

**Signatur:**
```typescript
// src/utils/fairScheduler.ts (Line 270)
export function generateGroupPhaseSchedule(
  options: GroupPhaseScheduleOptions
): Match[] {  // ← Kein zusätzliches Metadaten-Objekt
  // ...
}
```

**Fazit:** ✅ Funktion muss `Match[]` zurückgeben (keine Änderung nötig)

---

### 6. Gibt es bereits einen Error-Boundary um den Wizard?

**ANTWORT:** ❌ NEIN, existiert nicht!

**Beweis:**
```bash
# Suche nach ErrorBoundary:
grep -r "ErrorBoundary" src/
# → Keine Treffer
```

**Konsequenz für Plan:**
- **Blocker #4 ist REAL:** `throw new Error(...)` im Scheduler wird NICHT gefangen
- Der Error würde den React-Tree zum Absturz bringen
- UI-Error-Handling im Wizard (try/catch) ist daher ESSENTIELL

**Lösung im Plan:**
```typescript
// TournamentCreationWizard.tsx
const handleComplete = () => {
  try {
    const matches = generateGroupPhaseSchedule({ ... });
    onComplete(name.trim(), matches);
  } catch (error) {
    // ← MUSS hier gefangen werden
    setScheduleError(error.message);
  }
};
```

**Fazit:** ⚠️ Error-Handling im Wizard ist KRITISCH (kein ErrorBoundary vorhanden)

---

### 7. Wie wird das `Bye`-Team im UI dargestellt?

**ANTWORT:** ⚠️ GAR NICHT! (Feature existiert noch nicht)

**Beweis:**
```bash
# Suche nach "BYE", "Freilos", "bye" in allen UI-Komponenten:
grep -ri "bye\|freilos" src/**/*.tsx
# → Keine Treffer
```

**Aktueller Code:**
```typescript
// src/utils/fairScheduler.ts (Line 94)
const teamsWithBye = n % 2 === 0 ? [...teams] : [...teams, null as any];
// ← null wird stillschweigend herausgefiltert (Line 105)

if (teamA && teamB) {
  validPairings.push({ teamA, teamB });
}
// ← BYE-Pairings werden einfach ignoriert
```

**Konsequenz für Plan:**
- UI-Design ist OFFEN (kein bestehendes Pattern)
- Plan könnte vorschlagen:
  - Option A: Gar nicht anzeigen (wie aktuell)
  - Option B: "Freilos" Label im Spielplan
  - Option C: Separater "Ruhende Teams" Bereich

**Fazit:** ⚠️ UI-Design muss definiert werden (aktuell: keine UI-Darstellung)

---

### 8. Sind weitere Scheduler-Varianten (Play-off-Phase) von dieser Änderung betroffen?

**ANTWORT:** ❌ NEIN, Playoff-Scheduler ist NICHT betroffen

**Beweis:**
```typescript
// src/utils/playoffScheduler.ts (Line 17-25)
export interface PlayoffMatchDefinition {
  id: string;
  label: string;
  teamASource: string;  // ← String-basiert, KEIN Team-Objekt
  teamBSource: string;
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
  parallelMode: 'sequentialOnly' | 'parallelAllowed';
  dependencies: string[];
}
// ← Nutzt NICHT das TeamPairing Interface!
```

**Suche nach TeamPairing im Playoff-Code:**
```bash
grep "TeamPairing" src/utils/playoffScheduler.ts
# → Keine Treffer
```

**Fazit:** ✅ TeamPairing-Änderung betrifft NUR den Group-Phase-Scheduler

---

## 🔍 Kritische Code-Zusammenhänge

### Scheduler Aufruf-Kette

```
TournamentPreview.tsx
  ↓ generateFullSchedule()
    ↓ scheduleGenerator.ts (Line 155-162)
      ↓ fairScheduler.generateGroupPhaseSchedule()
        ↓ generateRoundRobinPairings() [Line 94: null as any]
        ↓ initializeTeamStates() [Line 287]
        ↓ schedulePairingsGreedy() [Line ~300-400]
          ↓ calculateFairnessScore() [Line 169-265]
            ↓ [HIER: FairnessCalculator soll integriert werden]
```

### Team Interface

```typescript
// src/types/tournament.ts (Line 10-14)
export interface Team {
  id: string;
  name: string;  // ← NICHT optional!
  group?: string;
}
```

**Antwort auf Agent-Frage A:** `name` ist required → Kein undefined möglich

---

## 🚨 Validierte Blocker (Real vs. Missverständnis)

### ✅ REAL Blocker

| # | Blocker | Status | Beweis |
|---|---------|--------|--------|
| 1 | **BYE-Handling Loop-Bug** | ✅ REAL | Line 105: `if (teamA && teamB)` filtert null, aber pairing bleibt in `remainingPairings` |
| 2 | **Fehlende `TeamScheduleState` Export** | ✅ REAL | Line 25: `interface TeamScheduleState` (kein `export`) |
| 4 | **Error nicht gefangen** | ✅ REAL | Kein ErrorBoundary vorhanden, try/catch im Wizard essentiell |
| 5 | **Performance-Test unrealistisch** | ⚠️ UNKLAR | Muss durch Benchmark validiert werden |
| 6 | **6h-Grenze hart codiert** | ⚠️ MINOR | Line ~TBD: `MAX_ACCEPTABLE_HOURS = 6` |
| 7 | **Fehlende Breaking-Change-Docs** | ✅ REAL | Kein Changelog vorhanden |

### ❌ KEIN Blocker (Missverständnis)

| # | "Blocker" | Warum KEIN Blocker | Beweis |
|---|-----------|-------------------|--------|
| 2b | **Fehlende `initializeTeamStates`** | ❌ FALSCH | Funktion existiert (Line 126-130) |
| 3 | **`minRestSlotsPerTeam` fehlt** | ❌ FALSCH | Existiert in Interface (Line 42) |

---

## 🎯 Empfohlene Fokus-Punkte für Agent

Der adesso Agent soll **gezielt** nach diesen Blockern im Plan suchen:

### Blocker #1: BYE-Handling Endless Loop

**Code-Stelle:** Line 94, Line 105 in fairScheduler.ts

**Frage an Agent:**
> "Suche im Plan nach der Stelle, wo der Scheduler-Loop das BYE-Team-Pairing behandelt. Prüfe: Wird das Pairing aus `remainingPairings` entfernt, wenn `teamB === null`? Oder bleibt es drin und verursacht eine Endlosschleife?"

**Erwartete Plan-Stelle:** Session 2, Stall Detection Code

---

### Blocker #2: `TeamScheduleState` Export

**Code-Stelle:** Line 25 in fairScheduler.ts

**Frage an Agent:**
> "Suche im Plan nach der Stelle, wo `FairnessCalculator.ts` das `TeamScheduleState` Interface importiert. Prüfe: Wird im Plan explizit ein Export hinzugefügt?"

**Erwartete Plan-Stelle:** Session 2, Phase 1 (FairnessCalculator-Klasse)

---

### Blocker #4: Uncaught Error

**Code-Stelle:** TournamentCreationWizard.tsx, handleComplete

**Frage an Agent:**
> "Suche im Plan nach der Stelle, wo der Wizard `generateGroupPhaseSchedule()` aufruft. Prüfe: Gibt es ein `try/catch`? Wird der Error wirklich gefangen, oder wirft der Scheduler-Loop vorher einen Error, der nicht gefangen wird?"

**Erwartete Plan-Stelle:** Session 3, Teil 2 (UI Error-Handling)

---

### Blocker #5: Performance-Test < 1s

**Code-Stelle:** Test-Suite

**Frage an Agent:**
> "Suche im Plan nach dem Performance-Test für 64 Teams. Prüfe: Ist das < 1s-Ziel realistisch für eine Browser-Umgebung (single-thread)? Sollte die Erwartung angepasst werden?"

**Erwartete Plan-Stelle:** Session 1, Testing: Minimal Viable Suite

---

### Blocker #7: Breaking Change Dokumentation

**Frage an Agent:**
> "Suche im Plan nach der Stelle, wo dokumentiert wird, dass `teamB: Team | null` ein Breaking Change ist. Gibt es eine Anweisung, alle Consumer-Komponenten zu finden und anzupassen?"

**Erwartete Plan-Stelle:** Session 1 oder Abschluss-Checkliste

---

## 📊 Code-Metriken

- **fairScheduler.ts:** 485 Zeilen
- **Interfaces:** 4 (GroupPhaseScheduleOptions, TeamScheduleState, TimeSlot, TeamPairing)
- **Hauptfunktionen:** 3 (generateGroupPhaseSchedule, calculateFairnessScore, schedulePairingsGreedy)
- **Test-Abdeckung:** 0% (keine Tests vorhanden)
- **Dependencies:** Match, Team aus tournament.ts

---

## 🔗 Datei-Referenzen

| Datei | Line | Was |
|-------|------|-----|
| `src/utils/fairScheduler.ts` | 25-32 | TeamScheduleState Interface (NICHT exportiert) |
| `src/utils/fairScheduler.ts` | 37-44 | GroupPhaseScheduleOptions Interface |
| `src/utils/fairScheduler.ts` | 77-80 | TeamPairing Interface |
| `src/utils/fairScheduler.ts` | 94 | `null as any` Bug |
| `src/utils/fairScheduler.ts` | 105 | BYE-Filter (`if (teamA && teamB)`) |
| `src/utils/fairScheduler.ts` | 126-141 | initializeTeamStates Funktion |
| `src/utils/fairScheduler.ts` | 169-265 | calculateFairnessScore (Performance-Bottleneck) |
| `src/utils/fairScheduler.ts` | 270 | generateGroupPhaseSchedule (Export) |
| `src/utils/fairScheduler.ts` | 287 | teamStates Initialisierung |
| `src/lib/scheduleGenerator.ts` | 155-162 | Aufruf von generateGroupPhaseSchedule |
| `src/types/tournament.ts` | 10-14 | Team Interface |
| `package.json` | 6-11 | Scripts (kein Test-Framework) |

---

## ✅ Fazit für Agent-Review

**Bestätigte Blocker:** 4 (von 7)
**Widerlegte Blocker:** 2 (Missverständnisse)
**Unklare Blocker:** 1 (Performance-Ziel)

**Nächster Schritt:** Agent soll mit DIESEM Kontext die 4 realen Blocker im Plan gezielt suchen und validieren, ob sie korrekt adressiert werden.
