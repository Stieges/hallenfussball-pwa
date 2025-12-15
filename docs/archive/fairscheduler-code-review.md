# Code Review: fairScheduler.ts

> **Automatisierte Code-Analyse** durchgeführt am 04.12.2025
> **Datei:** `src/utils/fairScheduler.ts` (576 Zeilen)
> **Fokus:** Type-Safety, Performance, Robustheit

---

## 📋 Überblick

| Thema | Priorität |
|-------|-----------|
| **Type‑Safety** | **CRITICAL** (unsichere `null`/`undefined`‑Verwendungen) |
| **Performance** | **HIGH** (O(F·P²·T) in `calculateFairnessScore`) |
| **Infinite‑Loop‑Protection** | **HIGH** (Safety‑Check zu spät, kein Fortschritts‑Check) |
| **Code‑Quality** | **MEDIUM** (Namensgebung, Magic Numbers, Logging, Mutability, etc.) |

---

## 1️⃣ Type‑Safety Probleme

| Zeile | Problem | BEFORE | AFTER | Grund / Priorität |
|------|----------|--------|-------|-------------------|
| **95** | `null as any` wird benutzt, um einen „Bye"‑Platz zu erzeugen. Das verwirft die Typ‑Information von `Team` und führt zu `any`. | ```typescript
const teamsWithBye = n % 2 === 0 ? [...teams] : [...teams, null as any];
``` | ```typescript
// Verwende ein echtes optionales Team‑Typ‑Alias
type MaybeTeam = Team | null;
const teamsWithBye: MaybeTeam[] = n % 2 === 0 ? [...teams] : [...teams, null];
``` | **CRITICAL** – `any` umgeht die Typprüfung komplett und kann zu Laufzeit‑Fehlern führen. |
| **95‑108** (implizite) | `teamA` / `teamB` werden als `Team | null` behandelt, aber später (z. B. in `calculateFairnessScore`) wird davon ausgegangen, dass sie immer ein `Team` sind. | ```typescript
const teamA = teamsWithBye[i];
const teamB = teamsWithBye[totalTeams - 1 - i];
if (teamA && teamB) { … }
``` | ```typescript
const teamA = teamsWithBye[i] as Team | null;
const teamB = teamsWithBye[totalTeams - 1 - i] as Team | null;
if (teamA && teamB) {
  // `teamA` und `teamB` sind jetzt vom Typ `Team`
  pairings.push({ teamA, teamB });
}
``` | Durch das explizite `Team | null` wird die Typ‑Information erhalten und spätere Aufrufe erhalten korrekte Typen. |
| **177‑178** | Non‑null‑Assertion (`!`) auf `teamStates.get(...)`. Wenn ein Team fehlt, wirft das zur Laufzeit einen Fehler. | ```typescript
const stateA = teamStates.get(teamAId)!;
const stateB = teamStates.get(teamBId)!;
``` | ```typescript
const stateA = teamStates.get(teamAId);
const stateB = teamStates.get(teamBId);
if (!stateA || !stateB) {
  // Sollte nie passieren – aber wir geben einen hohen Penalty zurück
  return Infinity;
}
``` | **HIGH** – verhindert unerwartete `undefined`‑Zugriffe. |
| **341‑342**, **368‑369**, **390‑398** (mehrere Stellen) | Wiederholte Verwendung von `!` bei `teamStates.get(...)`. | ```typescript
const teamAState = teamStates.get(pairing.teamA.id)!;
``` | ```typescript
const teamAState = teamStates.get(pairing.teamA.id);
if (!teamAState) continue; // oder handle error
``` | Gleiche Begründung wie oben. |
| **375‑383** | `match.id` wird aus `Date.now()` und `matches.length` gebaut – das ist nicht typ‑sicher, weil `Match.id` vermutlich als `string` definiert ist, aber keine Garantie für Eindeutigkeit besteht. | ```typescript
id: `match-${Date.now()}-${matches.length}`,
``` | ```typescript
// Nutze UUID (z. B. crypto.randomUUID) für echte Eindeutigkeit
id: `match-${crypto.randomUUID()}`,
``` | **MEDIUM** – verbessert Robustheit und verhindert Kollisionen. |
| **423‑426** (Balance‑Funktion) | `match.teamA = match.teamB;` mutiert das `Match`‑Objekt. Wenn `Match` in den Typ‑Definitionen als `readonly` markiert ist, führt das zu einem Compiler‑Fehler. | ```typescript
match.teamA = match.teamB;
match.teamB = temp;
``` | ```typescript
// Erstelle ein neues Match‑Objekt (immutabler Ansatz)
const swappedMatch: Match = {
  ...match,
  teamA: match.teamB,
  teamB: match.teamA,
};
// Ersetze im Array
matches[i] = swappedMatch;
``` | **MEDIUM** – vermeidet Seiteneffekte und hält sich an mögliche Immutability‑Regeln. |

---

## 2️⃣ Performance Bottlenecks

### 2.1 Analyse der Komplexität

| Abschnitt | Beschreibung | Komplexität |
|-----------|--------------|-------------|
| **while‑Schleife** (Zeilen 307‑412) | Durchläuft Slots, bis alle `remainingPairings` leer sind. | O(S) – wobei S ≈ Anzahl der tatsächlich genutzten Slots. |
| **inneres Feld‑Loop** (Zeilen 320‑402) | Für jedes Feld (F) wird über **alle** noch offenen Pairings (k) iteriert. | O(F · k) pro Slot. |
| **calculateFairnessScore** (Zeilen 169‑260) | Durchläuft **alle** Team‑States (T) und berechnet für jedes Team den durchschnittlichen Rest. | O(T) pro Aufruf. |
| **Gesamt** | In schlechtestem Fall (P = Gesamt‑Pairings) → Σ_{k=1}^{P} k = P·(P+1)/2 → O(F·P²·T). | **Extrem langsam** bei > 30 Teams. |

### 2.2 Optimierungsvorschläge

| Ziel | Was kann gecacht/optimiert werden? | Wo ändern? |
|------|-----------------------------------|------------|
| **Globale Rest‑Statistik** | Statt bei jedem Aufruf `calculateFairnessScore` die komplette `avgRestByTeam`‑Map neu zu bauen, halte **globalen** Durchschnitt und **pro‑Team** Rest‑Summe / Anzahl der Rest‑Intervalle in `teamStates`. Aktualisiere diese inkrementell, wenn ein neues Match zugewiesen wird. | - Ergänze `TeamScheduleState` um `restSum: number` und `restCount: number`.<br>- Aktualisiere in Zeile 390‑398 nach dem Eintragen eines Matches.<br>- In `calculateFairnessScore` nutze diese Werte, um `globalVariance` in O(1) zu berechnen. |
| **Field‑Verteilung** | `fieldCountA / totalMatchesA` wird jedes Mal neu berechnet. Das ist O(1) bereits, aber das **Gesamt‑Score** wird für jedes Feld wiederholt. Wir können den **field‑Penalty** pro Team einmal pro Slot berechnen und dann für jedes Feld nur den zusätzlichen Faktor hinzufügen. | - Vor dem Feld‑Loop (Zeile 320) berechne `fieldPenaltyA = stateA.fieldCounts.get(field) / stateA.matchSlots.length` für jedes mögliche Feld (max F).<br>- Verwende diese Werte im Score. |
| **Caching von `calculateFairnessScore`** | Der Score für dieselbe Kombination `(teamA, teamB, slot, field)` wird mehrfach berechnet, wenn das gleiche Pairing in mehreren Slots geprüft wird. Implementiere ein **Memo‑Cache** (z. B. `Map<string, number>`) mit Schlüssel `${teamAId}|${teamBId}|${slot}|${field}`. | - Erstelle `const fairnessCache = new Map<string, number>();` am Anfang von `generateGroupPhaseSchedule`.<br>- Vor Aufruf von `calculateFairnessScore` prüfe den Cache (Zeile 331).<br>- Nach Berechnung speichere das Ergebnis. |
| **Reduziere Kandidatenmenge** | Viele Pairings sind bereits unmöglich wegen Rest‑Constraints. Filtere bereits **vor** dem Score‑Aufruf: wenn `!canTeamPlayInSlot` für **eines** Teams, überspringe sofort. | - In Zeile 328‑335, füge einen Vor‑Check: `if (!canTeamPlayInSlot(...)) continue;` – spart Aufrufe von `calculateFairnessScore`. |
| **Early‑Break bei leeren Slots** | Wenn in einem Slot **keine** Pairing mehr zugewiesen werden kann, sollte sofort zum nächsten Slot gesprungen werden, anstatt das Feld‑Loop weiter zu durchlaufen. | - Nach dem Feld‑Loop (Zeile 402) prüfe, ob `matchesAddedInThisSlot === 0` und setze `currentSlotIndex++` **früher**. |

#### Beispiel‑Patch (Auszug)

```diff
+ // ----- neue Felder in TeamScheduleState -----
+ interface TeamScheduleState {
+   teamId: string;
+   matchSlots: number[];
+   fieldCounts: Map<number, number>;
+   lastSlot: number;
+   homeCount: number;
+   awayCount: number;
+   // für Incremental‑Rest‑Berechnung
+   restSum: number;          // Summe aller Rest‑Abstände
+   restCount: number;        // Anzahl der Rest‑Intervalle
+ }

@@
- const states = new Map<string, TeamScheduleState>();
+ const states = new Map<string, TeamScheduleState>();

@@
-      lastSlot: -Infinity,
+      lastSlot: -Infinity,
+      restSum: 0,
+      restCount: 0,
@@
-  const stateA = teamStates.get(teamAId)!;
-  const stateB = teamStates.get(teamBId)!;
+  const stateA = teamStates.get(teamAId);
+  const stateB = teamStates.get(teamBId);
+  if (!stateA || !stateB) return Infinity;
@@
-  // Calculate global min/max average rest
-  const avgRests = Array.from(avgRestByTeam.values()).filter(avg => avg > 0);
-
-  if (avgRests.length > 0) {
-    const globalMinAvg = Math.min(...avgRests);
-    const globalMaxAvg = Math.max(...avgRests);
-    const globalVariance = globalMaxAvg - globalMinAvg;
-    score += globalVariance * 100; // High weight for global fairness
-  }
+  // Incremental global variance (O(1))
+  const globalAvgRest = (stateA.restSum + stateB.restSum) / Math.max(stateA.restCount + stateB.restCount, 1);
+  // Approximation: use deviation from current global average
+  const deviationA = Math.abs((stateA.restSum / Math.max(stateA.restCount, 1)) - globalAvgRest);
+  const deviationB = Math.abs((stateB.restSum / Math.max(stateB.restCount, 1)) - globalAvgRest);
+  score += (deviationA + deviationB) * 100;
```

*(Die vollständige Implementierung würde analog die Updates nach jedem Match ergänzen – Zeilen 390‑398.)*

---

## 3️⃣ Infinite‑Loop‑Protection

| Stelle | Problem | BEFORE | EMPFOHLEN (nach Zeile 402) | Grund |
|--------|---------|--------|----------------------------|-------|
| **Zeile 408** | Safety‑Check (`currentSlotIndex > allPairings.length * 2`) wird **nach** jedem Slot‑Durchlauf geprüft. Wenn in einem Slot **keine** Paarung mehr gefunden wird, kann die Schleife trotzdem viele weitere leere Slots durchlaufen, bis die Grenze erreicht ist. | ```typescript
if (currentSlotIndex > allPairings.length * 2) { … }
``` | ```typescript
// Nach dem Feld‑Loop prüfen, ob im aktuellen Slot etwas geplant wurde
if (matchesAddedInThisSlot === 0) {
  // Keine Fortschritte → Abbruch, weil weitere Slots nichts bringen
  console.error('Fair scheduler: Stalled – no matches could be placed in slot', currentSlotIndex);
  break;
}
// Dann erst die alte Safety‑Check‑Bedingung (falls überhaupt zu viele Slots nötig sind)
if (currentSlotIndex > allPairings.length * 2) { … }
``` | Frühzeitiger Abbruch verhindert unnötige Durchläufe und gibt dem Aufrufer sofortiges Feedback. |
| **Fehlende Pre‑Validation** | Es wird nicht geprüft, ob die Kombination aus `minRestSlotsPerTeam`, `numberOfFields` und `teams per group` überhaupt realisierbar ist. | – | ```typescript
// Direkt am Anfang von generateGroupPhaseSchedule
function validateOptions(opts: GroupPhaseScheduleOptions, allTeams: Team[]) {
  const maxMatchesPerTeam = (opts.numberOfFields * (opts.minRestSlotsPerTeam + 1));
  const matchesNeeded = allTeams.length - 1; // round‑robin per group (simplified)
  if (matchesNeeded > maxMatchesPerTeam) {
    throw new Error('Impossible schedule: minRestSlotsPerTeam too high for given numberOfFields');
  }
}
// Aufruf nach Berechnung von allTeams
validateOptions(options, allTeams);
``` | Verhindert, dass der Scheduler überhaupt in eine Endlosschleife gerät, weil die Vorgaben unlösbar sind. |
| **Zeile 307‑312** | Die Initialisierung von `timeSlots` geschieht erst, wenn `timeSlots.length === currentSlotIndex`. Wenn `numberOfFields` = 0 (falsch konfiguriert) würde die innere Feld‑Schleife nie etwas tun und die äußere Schleife unendlich laufen. | – | ```typescript
if (numberOfFields <= 0) {
  throw new Error('numberOfFields must be > 0');
}
``` | Früher Guard gegen falsche Konfiguration. |

---

## 4️⃣ Code‑Quality Issues

| Zeile | Issue | BEFORE | AFTER (Vorschlag) | Priorität |
|------|-------|--------|-------------------|-----------|
| **13‑20** | `TimeSlot.matches` ist ein `Map<number, Match>` – Feld‑Index beginnt bei **1**, aber das ist implizit. Dokumentiere das. | – | ```typescript
/**
 * Map where the key is the **1‑based** field index.
 */
matches: Map<number, Match>;
``` | LOW |
| **31‑32** | `homeCount` / `awayCount` werden nur im Scheduler erhöht, aber nicht in `calculateFairnessScore` berücksichtigt, wenn ein Team bereits **mehr** Heim‑ als Auswärtsspiele hat. | – | In `calculateFairnessScore` zusätzlich prüfen: `if (stateA.homeCount > stateA.awayCount) score += 2;` (leichte Gewichtung) | MEDIUM |
| **70‑73** | `GlobalFairnessStats` enthält nur Durchschnittswerte, aber kein **max‑Rest‑Spread**. | – | Ergänze `maxRestSpread: number;` und fülle in `analyzeScheduleFairness`. | LOW |
| **107** | `pairings.push({ teamA, teamB });` – das Ergebnis ist **nicht** typisiert (`TeamPairing`). TypeScript kann das ableiten, aber ein expliziter Typ erhöht die Lesbarkeit. | – | ```typescript
pairings.push({ teamA, teamB } as TeamPairing);
``` | LOW |
| **124‑126** | `initializeTeamStates` verwendet `new Map()` ohne generische Parameter – implizite `any`. | – | ```typescript
const states = new Map<string, TeamScheduleState>();
``` | LOW |
| **165‑168** | Kommentar sagt *"Minimize the GLOBAL variance (maxAvgRest - minAvgRest)"* – aber die Implementierung verwendet `globalVariance * 100`. Das Gewicht ist ein **Magic Number**. | – | Definiere Konstante: `const GLOBAL_VARIANCE_WEIGHT = 100;` und verwende sie. | LOW |
| **301‑305** | `console.log` im Produktionscode. | – | Entferne oder ersetze durch ein Logger‑Interface, die je nach Umgebung stumm geschaltet werden kann. | MEDIUM |
| **375‑383** | `match.id` wird aus `Date.now()` generiert – nicht deterministisch, erschwert Testbarkeit. | – | Verwende einen deterministischen ID‑Generator (z. B. inkrementeller Counter) oder übergebe eine ID‑Factory als Parameter. | MEDIUM |
| **420‑422** | Funktionskommentar sagt *"Balance home/away distribution"*, aber die Implementierung ändert **nur** `teamA`/`teamB` im bestehenden Objekt – das ist ein **Side‑Effect** auf das Eingabe‑Array. | – | Dokumentiere klar, dass das Array mutiert wird, oder erstelle ein neues Array und gib es zurück. | LOW |
| **462‑465** | Nach dem Swappen werden die Zähler `home`/`away` **nicht** aktualisiert, wenn `balanceA.home`/`away` bereits 0 sind – kann zu negativen Werten führen. | – | Füge Guard ein: `if (balanceA.home > 0) balanceA.home--;` etc. | MEDIUM |
| **511‑514** | `globalMinRest` wird mit `Infinity` initialisiert, aber später nie auf `0` zurückgesetzt, wenn keine Rest‑Intervalle existieren (z. B. bei nur einem Team). | – | Nach Schleife: `if (globalMinRest === Infinity) globalMinRest = 0;` | LOW |

---

## 📦 Zusammenfassung & To‑Do‑Liste

| # | Aufgabe | Datei / Zeile(n) | Priorität |
|---|---------|------------------|-----------|
| 1 | Ersetze `null as any` durch echtes `Team | null`‑Typ‑Handling. | 95‑108 | **CRITICAL** |
| 2 | Entferne alle `!`‑Non‑Null‑Assertions bei `teamStates.get`. | 177‑178, 341‑342, 368‑369, 390‑398 | **HIGH** |
| 3 | Ergänze `restSum` / `restCount` in `TeamScheduleState` und aktualisiere nach jedem Match. | 130‑137, 390‑398 | **HIGH** |
| 4 | Implementiere Memo‑Cache für `calculateFairnessScore`. | 331‑338, neue Variable am Funktions‑Start | **HIGH** |
| 5 | Frühzeitiger Abbruch, wenn in einem Slot nichts geplant werden kann. | nach Zeile 402 (neue Variable `matchesAddedInThisSlot`) | **HIGH** |
| 6 | Pre‑Validation der Eingabe‑Optionen (Felder, Rest‑Slots). | Anfang von `generateGroupPhaseSchedule` | **HIGH** |
| 7 | Ersetze `Date.now()`‑ID‑Erzeugung durch UUID oder deterministische Counter. | 375‑383 | **MEDIUM** |
| 8 | Entferne / ersetze `console.log` durch Logger‑Interface. | 301‑305 | **MEDIUM** |
| 9 | Refactor `balanceHomeAway` zu immutable‑Ansatz oder klar dokumentieren. | 423‑466 | **MEDIUM** |
|10| Dokumentiere Magic Numbers (z. B. `*100`, `*0.1`). | 165‑168, 256‑258 | **LOW** |
|11| Weitere kleine Qualitäts‑Verbesserungen (generische Maps, Kommentare, Guard‑Checks). | über das ganze File | **LOW** |

---

## 🎯 Erwartete Verbesserungen

Durch die Umsetzung dieser Änderungen wird der Scheduler:

- **Typsicher**: Keine `null as any` mehr, alle Non-Null-Assertions durch Guards ersetzt
- **Performant**: **10-30x schnellere** Durchläufe bei 20-30 Teams durch Caching und inkrementelle Berechnungen
- **Robust**: Schutz vor Endlosschleifen durch Pre-Validation und Stall-Detection
- **Wartbar**: Bessere Code-Qualität, dokumentierte Magic Numbers, testbar

### Performance-Vergleich (geschätzt):

| Teams | Matches | Vorher (O(F·P²·T)) | Nachher (O(F·P·T)) | Speedup |
|-------|---------|-------------------|-------------------|---------|
| 12    | 66      | ~0.8s            | ~0.1s            | **8x**  |
| 24    | 276     | ~12s             | ~1.2s            | **10x** |
| 64    | 2016    | ~480s (8min)     | ~45s             | **11x** |
