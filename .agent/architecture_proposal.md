# State-of-the-Art Architecture Proposal: Hallenfussball PWA

> **Objective:** Restructure the application to eliminate "Truth Conflicts" (Generator vs. Persistence), improve maintainability, and ensure robost reliability for live usage.

## 1. Core Philosophy: "Local-First Domain Driven Design"

The application is essentially a database management system running in the browser. We should treat it as such, moving away from "React State" holding the truth to a **Domain Layer** holding the truth.

### Key Concepts
1.  **Single Source of Truth (The Store):** The `Tournament` object in `localStorage` is the database. React is just a view.
2.  **Explicit State Transitions:** No more "implicit generation" on load. Schedule generation is an **Action** (Command).
3.  **Separation of Concerns:**
    *   **Definition:** What the tournament *is* (Teams, Rules).
    *   **Schedule:** When matches *happen* (Time, Field).
    *   **Execution:** What *happened* (Scores, Events).

## 2. Proposed Layered Architecture

```mermaid
graph TD
    UI[React Components (UI)] -->|Read| Hooks[React Hooks (View Model)]
    UI -->|Dispatch Actions| Services[Domain Services]
    
    subgraph "Domain Layer (Pure Logic)"
        Services -->|Mutate| Store[Tournament Store / Repository]
        Generator[Schedule Generator] -.->|Produces| Services
    end
    
    subgraph "Persistence Layer"
        Store -->|Persist| LocalStorage[(LocalStorage / DB)]
    end
```

## 3. Detailed Data Flow

### A. Tournament Definition (Setup Phase)
*   **Current:** Wizard updates huge state object.
*   **Target:** `TournamentService.createDraft()`, `TournamentService.updateSettings()`.
*   **Validation:** Strict Zod/Schema validation at the Service boundary.

### B. Scheduling (The Fix for Persistence)
This is where the biggest change happens.

*   **Current (Flawed):**
    *   Load Page -> `useTournamentSync` -> `generateSchedule()` -> "Oh wait, I have saved matches, let me try to merge them".
*   **Target (Explicit):**
    *   **Action:** User clicks "Create Schedule" or finishes Wizard.
    *   **Service:** `ScheduleService.generate(tournamentId)` runs the Generator *once*.
    *   **Result:** A list of `Match` objects is saved to the Store.
    *   **View:** `ScheduleEditor` reads *only* from the Store.
    *   **Modification:** Drag & Drop calls `ScheduleService.updateMatch(id, { time, field })`.
    *   **Reload:** Reads the Store. **No generation happens.**

### C. Live Execution
*   **Current:** `useLiveMatchManagement` mixes reading state and writing execution.
*   **Target:** `MatchExecutionService`.
    *   `startMatch(id)`
    *   `scoreGoal(id, teamId)`
    *   `endMatch(id)`
    *   **Optimistic UI:** The UI updates instantly, Service persists in background (already mostly the case, but formalized).

## 4. Directory Structure (Refactoring Target)

```text
src/
  ├── core/                 <-- NEW: Pure Domain Logic (No React)
  │   ├── models/           <-- Types & Zod Schemas
  │   ├── services/         <-- Business Logic (TournamentService, ScheduleService)
  │   ├── repositories/     <-- Data Access (LocalStorageRepository)
  │   └── generators/       <-- The Math (scheduleGenerator, fairScheduler)
  │
  ├── features/             <-- React Features (UI)
  │   ├── tournament/       <-- Wizard, Settings
  │   ├── schedule/         <-- ScheduleEditor, Viewer
  │   └── cockpit/          <-- Live Execution
  │
  ├── shared/               <-- UI Components, Utils
  └── hooks/                <-- Bridges core -> features (useTournament, useSchedule)
```

## 5. Benefits
1.  **Zero "Magic":** Schedules never change unless a user explicitly changes them or requests a re-generation.
2.  **Testability:** We can unit test `ScheduleService` without mocking React, LocalStorage, or Browser behavior.
3.  **Migration Path:** We can move `scheduleGenerator.ts` into `core/generators/` immediately and wrap it in a Service.

## 6. Database Readiness (Supabase / Backend)
**Yes, this architecture is perfectly suited for a switch to Supabase.**

We achieve this via the **Repository Pattern**:

### The Abstraction
The `Service Layer` never talks to `localStorage` directly. It talks to an interface:

```typescript
interface ITournamentRepository {
  getTournament(id: string): Promise<Tournament | null>;
  saveTournament(tournament: Tournament): Promise<void>;
  updateMatch(tournamentId: string, match: Match): Promise<void>;
}
```

### The Implementation Swap
*   **Phase 1 (Current):** We implement `LocalStorageRepository` which implements this interface using the browser's storage.
*   **Phase 2 (Migration):** We create `SupabaseRepository` which implements the *same* interface but calls the API.

**Benefit:** The "Service Layer" (Scheduling rules, Drag & Drop logic, etc.) **does not need to change at all** when you switch databases. You purely swap the data connector.

## 7. Implementation Plan
1.  **Phase 1 (Foundation):** Create `core/services/ScheduleService.ts`. Move "Rehydration" logic there as `loadMatches()`.
2.  **Phase 2 (Decoupling):** Update `ScheduleEditor` to use `ScheduleService` instead of direct hook logic.
## 8. Logic Representation (Code Preview)

Here is how the new logic will look in practice. This is "Service-Oriented" code, which is cleaner and easier to test than the current "Hook-Soup".

### The Core Service (`src/core/services/ScheduleService.ts`)
This class encapsulates the *Business Logic*. It does not know about React.

```typescript
export class ScheduleService {
  constructor(
    private tournamentRepo: ITournamentRepository,
    private generator: ScheduleGenerator
  ) {}

  /**
   * Defines the "Load" logic:
   * 1. Try to load matches from DB.
   * 2. ONLY if empty (and not just a draft), generate a default plan.
   */
  async ensureSchedule(tournamentId: string): Promise<Match[]> {
    const tournament = await this.tournamentRepo.getTournament(tournamentId);
    
    // Case A: Schedule exists (Truth is in DB)
    if (tournament.matches.length > 0) {
      return tournament.matches;
    }

    // Case B: New Schedule needed (Generate & Persist)
    const newMatches = this.generator.generate(tournament);
    await this.tournamentRepo.saveMatches(tournamentId, newMatches);
    return newMatches;
  }

  /**
   * Defines "Update" logic (Drag & Drop)
   * The Service ensures validity before saving.
   */
  async moveMatch(tournamentId: string, matchId: string, newTime: Date, newField: number): Promise<void> {
    const tournament = await this.tournamentRepo.getTournament(tournamentId);
    
    // 1. Apply Change
    const updatedMatches = tournament.matches.map(m => 
      m.id === matchId ? { ...m, scheduledTime: newTime, field: newField } : m
    );

    // 2. Validate (Optional business rules check)
    // if (this.hasConflicts(updatedMatches)) throw new Error("Conflict!");

    // 3. Persist
    await this.tournamentRepo.updateMatches(tournamentId, updatedMatches);
  }
}
```

### The React Integration (`src/hooks/useScheduleManager.ts`)
The Hook becomes a thin wrapper (Controller) that connects the UI to the Service.

```typescript
export function useScheduleManager(tournamentId: string) {
  const { repository } = useRepository(); // Access DB
  const service = useMemo(() => new ScheduleService(repository), [repository]);
  
  // State is just for View, not for Logic
  const { data: matches, mutate } = useQuery(['matches', tournamentId], () => service.ensureSchedule(tournamentId));

  const moveMatch = async (matchId: string, time: Date, field: number) => {
    // Optimistic UI Update can happen here
    await service.moveMatch(tournamentId, matchId, time, field);
    mutate(); // Refresh data
  };

  return { matches, moveMatch };
}
```
