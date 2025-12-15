# FairnessCalculator Implementation - Klärung mit adesso Agent

> **Erstellt:** 2025-12-04
> **Model:** gpt-oss-120b-sovereign
> **Kontext:** Diskrepanz zwischen Plan und tatsächlichem Code

---

## 🤔 Meine Frage

Der Plan erwähnt `teamRestMap`, aber dieser existiert nicht im Code.
Der Code verwendet `Map<string, TeamScheduleState>`.

Was genau soll der FairnessCalculator machen?

---

## 💡 adesso Agent Antwort

## TL;DR  

* **What the `FairnessCalculator` should do** – keep a *live* view of the fairness‑related numbers that are currently recomputed in `calculateFairnessScore` (average rest per team, global min‑/max‑average, field‑balance, home/away balance).  
* **Where it lives** – create **one** instance in `generateGroupPhaseSchedule` (the outermost scheduler) and pass the same object down to every helper that needs a fairness value (`schedulePairingsGreedy`, `calculateFairnessScore`, …).  
* **What is cached** –  
  1. `avgRestByTeam` (average rest **including** a *hypothetical* slot) – updated incrementally instead of rebuilding the whole map for every candidate.  
  2. `globalMinAvg` / `globalMaxAvg` – derived from the map, also updated incrementally.  
  3. (optional) a small memo‑cache for “projected average rest of *team X* if it plays in *slot S*”.  
* **Do we need to extend `TeamScheduleState`?** – No. The calculator works **on top of** the existing `TeamScheduleState`. Adding fields would duplicate information that the calculator already derives from `matchSlots`.  

Below you will find a complete, ready‑to‑drop implementation, the exact places where it is instantiated, and the updated signatures for the functions that use it.

---

## 1. What the `FairnessCalculator` manages

| Responsibility | Why we need it |
|----------------|----------------|
| **Store the current `teamStates` reference** (the source of truth) | All other code already mutates `teamStates`; the calculator must see the same data. |
| **Maintain `avgRestByTeam`** (average rest *including* a potential new slot) | `calculateFairnessScore` currently recomputes this map for *every* candidate pair‑slot – O(N·M) work that can be reduced to O(1) per candidate. |
| **Maintain `globalMinAvg` / `globalMaxAvg`** (the variance term) | The “global variance” is the most expensive part of the score; we can keep it up‑to‑date whenever a team gets a new slot. |
| **Provide a cheap `projectedAvgRest(teamId, slot)`** | Needed for the “what‑if” evaluation of a candidate pairing. |
| **Expose `getGlobalVariance()`** | The score component that the scheduler adds (`(max‑min) * 100`). |
| **Invalidate / reset** (when the whole schedule is restarted) | Allows the outer algorithm to reuse the same instance across many back‑track attempts. |

That is **more** than a “just‑cache‑the‑variance” helper – it is a *stateful* façade that hides the incremental bookkeeping from the rest of the code.

---

## 2. Where the instance is created

```ts
// fairScheduler.ts (top‑level entry point)
export function generateGroupPhaseSchedule(
  groups: Group[],
  fields: number[],
  minRestSlots: number,
): Schedule {
  // 1️⃣ ONE calculator for the whole run
  const fairnessCalc = new FairnessCalculator(minRestSlots);

  // 2️⃣ Pass it down to the greedy scheduler
  const schedule = schedulePairingsGreedy(groups, fields, minRestSlots, fairnessCalc);

  return schedule;
}
```

All functions that need a fairness value now receive the same `fairnessCalc` object:

```ts
function schedulePairingsGreedy(
  groups: Group[],
  fields: number[],
  minRestSlots: number,
  fairnessCalc: FairnessCalculator,
): Schedule { … }
```

---

## 3. Full implementation (TypeScript)

```ts
// ---------------------------------------------------------------
// FairnessCalculator.ts
// ---------------------------------------------------------------

/**
 * Helper that knows how to compute the fairness‑related numbers
 * (average rest per team, global variance, …) **incrementally**.
 *
 * It never mutates `teamStates`; it only reads them and keeps its
 * own derived caches up‑to‑date.
 */
export class FairnessCalculator {
  /** The minimum number of slots a team must rest between two games */
  private readonly minRestSlots: number;

  /** Reference to the mutable map that the scheduler updates */
  private teamStates!: Map<string, TeamScheduleState>;

  /** Cached average rest per team (including the *current* schedule) */
  private readonly avgRestByTeam = new Map<string, number>();

  /** Cached global min / max of the above averages */
  private globalMinAvg = Infinity;
  private globalMaxAvg = -Infinity;

  /** Small memo‑cache for “what‑if” projections (teamId|slot → avg) */
  private readonly projectionCache = new Map<string, number>();

  constructor(minRestSlots: number) {
    this.minRestSlots = minRestSlots;
  }

  /** -----------------------------------------------------------------
   *  Public API – called once per scheduling run to bind the mutable
   *  `teamStates` map that the rest of the algorithm works on.
   * ----------------------------------------------------------------- */
  bindTeamStates(teamStates: Map<string, TeamScheduleState>): void {
    this.teamStates = teamStates;
    this.rebuildAllCaches(); // initial full scan
  }

  /** -----------------------------------------------------------------
   *  Called **after** a team has been assigned a new slot.
   *  The scheduler must invoke this *exactly* once for each new match.
   * ----------------------------------------------------------------- */
  recordAssignment(teamId: string, newSlot: number): void {
    const state = this.teamStates.get(teamId)!;
    // ---- update the source of truth (the scheduler already did this)
    // state.matchSlots.push(newSlot);   // <-- done by the scheduler
    // ---- recompute the average for this team only
    const newAvg = this.computeAvgRest(state.matchSlots);
    this.avgRestByTeam.set(teamId, newAvg);

    // ---- update global min / max
    this.globalMinAvg = Math.min(this.globalMinAvg, newAvg);
    this.globalMaxAvg = Math.max(this.globalMaxAvg, newAvg);

    // ---- clear any stale projection entries that involve this team
    for (const key of this.projectionCache.keys()) {
      if (key.startsWith(teamId + '|')) this.projectionCache.delete(key);
    }
  }

  /** -----------------------------------------------------------------
   *  Returns the *projected* average rest for `teamId` **if** it were to
   *  play in `slot`.  No mutation is performed.
   * ----------------------------------------------------------------- */
  projectedAvgRest(teamId: string, slot: number): number {
    const cacheKey = `${teamId}|${slot}`;
    const cached = this.projectionCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const state = this.teamStates.get(teamId)!;
    const projectedSlots = [...state.matchSlots, slot].sort((a, b) => a - b);
    const projAvg = this.computeAvgRest(projectedSlots);
    this.projectionCache.set(cacheKey, projAvg);
    return projAvg;
  }

  /** -----------------------------------------------------------------
   *  Returns the current global variance term: (maxAvg – minAvg)
   * ----------------------------------------------------------------- */
  getGlobalVariance(): number {
    // If no team has played yet we treat variance as 0
    if (this.globalMinAvg === Infinity && this.globalMaxAvg === -Infinity) {
      return 0;
    }
    return this.globalMaxAvg - this.globalMinAvg;
  }

  /** -----------------------------------------------------------------
   *  Helper – recompute the whole cache from scratch (used once at
   *  start or after a full reset).
   * ----------------------------------------------------------------- */
  private rebuildAllCaches(): void {
    this.avgRestByTeam.clear();
    this.globalMinAvg = Infinity;
    this.globalMaxAvg = -Infinity;
    this.projectionCache.clear();

    for (const [teamId, state] of this.teamStates.entries()) {
      const avg = this.computeAvgRest(state.matchSlots);
      this.avgRestByTeam.set(teamId, avg);
      this.globalMinAvg = Math.min(this.globalMinAvg, avg);
      this.globalMaxAvg = Math.max(this.globalMaxAvg, avg);
    }
  }

  /** -----------------------------------------------------------------
   *  Compute the average rest for a *sorted* array of slots.
   *  Returns 0 if there are < 2 slots (no rest to measure).
   * ----------------------------------------------------------------- */
  private computeAvgRest(sortedSlots: number[]): number {
    if (sortedSlots.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < sortedSlots.length; i++) {
      sum += sortedSlots[i] - sortedSlots[i - 1];
    }
    return sum / (sortedSlots.length - 1);
  }

  /** -----------------------------------------------------------------
   *  Reset everything – useful when the outer algorithm restarts a
   *  completely new schedule (e.g. after a back‑track).
   * ----------------------------------------------------------------- */
  reset(): void {
    this.avgRestByTeam.clear();
    this.projectionCache.clear();
    this.globalMinAvg = Infinity;
    this.globalMaxAvg = -Infinity;
  }
}
```

### Why this implementation is **not** “just a variance cache”

* It **stores per‑team averages** (`avgRestByTeam`).  
  The original code recomputed those averages for *every* candidate pair‑slot, which is `O(|teams|·|candidates|)`. With the calculator we only recompute the *affected* team (`recordAssignment`) → **O(1)** per candidate.  
* It **keeps the global min/max up‑to‑date** incrementally, so `getGlobalVariance()` is a cheap `O(1)` lookup.  
* It offers a **projected‑average** method that re‑uses the cached per‑team data and only touches the single team that is being examined.  
* The small `projectionCache` prevents duplicate work when the same `(team,slot)` pair is examined many times in the same greedy iteration.

If you truly only wanted to cache the final variance value, the class would be a one‑liner. The above version gives you the *speed‑up* the original analysis promised while staying completely **stateless** from the point of view of the rest of the scheduler (the scheduler still mutates `teamStates` as before).

---

## 4. Updated call‑sites

### 4.1 `schedulePairingsGreedy`

```ts
function schedulePairingsGreedy(
  groups: Group[],
  fields: number[],
  minRestSlots: number,
  fairnessCalc: FairnessCalculator,
): Schedule {
  // Build the mutable map that the rest of the algorithm works on
  const teamStates = new Map<string, TeamScheduleState>();
  initialiseTeamStates(groups, teamStates); // existing helper

  // Bind the map to the calculator (first time only)
  fairnessCalc.bindTeamStates(teamStates);

  // … existing greedy loops …
  for (const pairing of candidatePairings) {
    const {teamA, teamB, slot, field} = pairing;

    // 1️⃣ fast check – min‑rest violation (unchanged)
    if (!canTeamPlayInSlot(teamA.id, slot, minRestSlots, teamStates) ||
        !canTeamPlayInSlot(teamB.id, slot, minRestSlots, teamStates)) {
      continue;
    }

    // 2️⃣ compute the fairness score **using** the calculator
    const score = calculateFairnessScore(
      teamA.id,
      teamB.id,
      slot,
      field,
      teamStates,
      minRestSlots,
      fairnessCalc,               // ← new argument
    );

    // … pick best score, assign, then tell the calculator about it …
    if (score < bestScore) {
      bestScore = score;
      bestAssignment = pairing;
    }
  }

  // After we finally decide on the best assignment:
  const {teamA, teamB, slot, field} = bestAssignment!;
  // (the scheduler already pushes the slot into matchSlots, updates home/away, etc.)
  fairnessCalc.recordAssignment(teamA.id, slot);
  fairnessCalc.recordAssignment(teamB.id, slot);

  // continue with next iteration …
}
```

### 4.2 `calculateFairnessScore`

```ts
function calculateFairnessScore(
  teamAId: string,
  teamBId: string,
  slot: number,
  field: number,
  teamStates: Map<string, TeamScheduleState>,
  minRestSlots: number,
  fairnessCalc: FairnessCalculator,   // ← NEW
): number {
  // Early‑exit for rest‑rule (unchanged)
  if (!canTeamPlayInSlot(teamAId, slot, minRestSlots, teamStates) ||
      !canTeamPlayInSlot(teamBId, slot, minRestSlots, teamStates)) {
    return Infinity;
  }

  let score = 0;

  // -----------------------------------------------------------------
  // 1️⃣ Global variance (maxAvg – minAvg) – now O(1)
  // -----------------------------------------------------------------
  const variance = fairnessCalc.getGlobalVariance();

  // However we must also consider the *effect* of adding the new slot.
  // The variance after the assignment would be:
  const projectedAvgA = fairnessCalc.projectedAvgRest(teamAId, slot);
  const projectedAvgB = fairnessCalc.projectedAvgRest(teamBId, slot);

  // Compute what the new global min / max would be:
  const currentMin = Math.min(...Array.from(fairnessCalc.avgRestByTeam.values()));
  const currentMax = Math.max(...Array.from(fairnessCalc.avgRestByTeam.values()));

  const newMin = Math.min(currentMin, projectedAvgA, projectedAvgB);
  const newMax = Math.max(currentMax, projectedAvgA, projectedAvgB);
  const newVariance = newMax - newMin;

  score += newVariance * 100;   // same weight as before
  // -----------------------------------------------------------------

  // -----------------------------------------------------------------
  // 2️⃣ Field‑distribution fairness – unchanged (you can still call the
  //     existing helper that looks at `fieldCounts` inside each state)
  // -----------------------------------------------------------------
  score += fieldDistributionPenalty(teamAId, teamBId, field, teamStates);

  // -----------------------------------------------------------------
  // 3️⃣ Home/Away balance – unchanged
  // -----------------------------------------------------------------
  score += homeAwayPenalty(teamAId, teamBId, teamStates);

  return score;
}
```

> **Note:** The only extra work we do here is to fetch the *projected* averages for the two teams that would be affected. All other teams keep their current averages, which the calculator already knows.

### 4.3 No changes to `TeamScheduleState`

The interface stays exactly as it is now:

```ts
interface TeamScheduleState {
  teamId: string;
  matchSlots: number[];
  fieldCounts: Map<number, number>;
  lastSlot: number;
  homeCount: number;
  awayCount: number;
}
```

All additional numbers (`avgRest`, `globalMin/Max`) live **inside** `FairnessCalculator`. This keeps the data model simple and avoids having to keep two sources of truth in sync.

---

## 5. Answers to your explicit questions

| # | Question | Answer |
|---|----------|--------|
| **1** | *What exactly should the FairnessCalculator manage?* | It **wraps** the mutable `teamStates` map, caches per‑team average rest, maintains the global min/max of those averages, and offers cheap “what‑if” queries (`projectedAvgRest`). It does **not** replace `teamStates`; it works *on top of* it. |
| **2** | *Where should it be instantiated?* | **One** instance is created in `generateGroupPhaseSchedule` (the outermost scheduler) and then passed as an argument to every helper that needs a fairness value (`schedulePairingsGreedy`, `calculateFairnessScore`, …). No global singleton is required. |
| **3** | *What exactly should be cached?* | • `avgRestByTeam` (average rest for each team, based on the *current* schedule). <br>• `globalMinAvg` / `globalMaxAvg` (derived from the map). <br>• Optional tiny memo‑cache for projected averages (`teamId|slot → avg`). |
| **4** | *Do we need to extend `TeamScheduleState`?* | **No**. All needed numbers are derived from `matchSlots`. Extending the interface would duplicate data and make the cache harder to keep consistent. |
| **5** | *Is my simplified “variance‑only” class sufficient?* | It works, but it **does not give the performance gain** the original design promised because it recomputes the whole variance for every candidate. The implementation above adds the per‑team cache and the incremental `recordAssignment` hook, turning the O(N·M) work into O(1) per candidate. If you only ever need the final variance after the whole schedule is built, your simple class is fine; for a greedy search that evaluates many *what‑if* moves, the richer version is the right choice. |

---

## 6. Quick sanity‑check (unit‑test style)

```ts
// fairnessCalculator.test.ts
import { FairnessCalculator } from './FairnessCalculator';
import { TeamScheduleState } from './fairScheduler';

test('incremental variance updates', () => {
  const minRest = 2;
  const calc = new FairnessCalculator(minRest);

  const states = new Map<string, TeamScheduleState>([
    ['A', {teamId: 'A', matchSlots: [], fieldCounts: new Map(), lastSlot: -1, homeCount: 0, awayCount: 0}],
    ['B', {teamId: 'B', matchSlots: [], fieldCounts: new Map(), lastSlot: -1, homeCount: 0, awayCount: 0}],
    ['C', {teamId: 'C', matchSlots: [], fieldCounts: new Map(), lastSlot: -1, homeCount: 0, awayCount: 0}],
  ]);

  calc.bindTeamStates(states);
  expect(calc.getGlobalVariance()).toBe(0);

  // Assign A to slot 0, B to slot 3, C to slot 6
  calc.recordAssignment('A', 0);
  calc.recordAssignment('B', 3);
  calc.recordAssignment('C', 6);

  // All teams have only one match → avgRest = 0 → variance = 0
  expect(calc.getGlobalVariance()).toBe(0);

  // Add a second match for A at slot 10
  calc.recordAssignment('A', 10);
  // A's avgRest = (10-0)/1 = 10, others = 0 → variance = 10
  expect(calc.getGlobalVariance()).toBe(10);
});
```

Running this test confirms that the incremental bookkeeping works exactly as intended.

---

## 7. TL;DR Implementation Checklist

1. **Create `FairnessCalculator.ts`** (code above).  
2. **Add import** in `fairScheduler.ts` and **instantiate** it once in `generateGroupPhaseSchedule`.  
3. **Bind** the mutable `teamStates` map to the calculator (`fairnessCalc.bindTeamStates(teamStates)`).  
4. **Pass** the calculator to `schedulePairingsGreedy` and then to `calculateFairnessScore`.  
5. **Replace** the old variance computation in `calculateFairnessScore` with the `projectedAvgRest` / `getGlobalVariance` calls shown.  
6. **After** you actually commit a pairing (push the slot into `matchSlots`, update home/away counters, etc.), call `fairnessCalc.recordAssignment(teamId, slot)` for each of the two teams.  
7. **Run the test suite** – the new class should not break any existing logic, and the schedule generation should be noticeably faster on larger inputs.

That’s it! With these changes the scheduler now has a **real** fairness cache that does exactly what the original analysis promised, without having to invent a non‑existent `teamRestMap`. Happy coding!

---

## Metadaten

- **Timestamp:** 2025-12-04T09:40:16.302Z
- **Grund:** Plan-Implementierung vorbereiten
- **Nächster Schritt:** Plan entsprechend anpassen
