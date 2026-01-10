# Codebase Performance Audit

**Status:** In Progress
**Scope:** Full Codebase (React Rendering, State, Bundle Size, Data)
**Objective:** Identify performance bottlenecks and provide concrete optimization strategies.

## 1. React Rendering & Component Performance
*Status: Completed*

### Critical Issues
*   **[CRITICAL] LiveCockpit Re-render Storm:**
    *   **Source:** `useMatchExecution` updates `elapsedSeconds` every 1000ms.
    *   **Impact:** `LiveCockpit` re-renders every second.
    *   **Cascade:** Child components `TeamBlock`, `FoulBar`, `GameControls` are NOT memoized (`React.memo`). They re-render unnecessarily 60 times/min.
    *   **Fix:** Wrap these components in `React.memo`.

*   **[HIGH] ScheduleEditor Drag Performance:**
    *   **Source:** `useDragDrop` updates `activeId` on drag start/move.
    *   **Impact:** The entire `ScheduleEditor` grid re-renders.
    *   **Leak:** `TimeSlot` and `DraggableMatch` are functional components without `React.memo`. Every single slot and match card re-renders when *one* card is dragged.
    *   **Fix:** Implement `React.memo` for `TimeSlot` and `DraggableMatch` with custom `arePropsEqual` check if needed.

## 2. State Management & Data Flow
*Status: Completed*

### Critical Issues
*   **[HIGH] Redundant Data Fetching:**
    *   **Location:** `useMatchExecution.ts` (L120 `useEffect`).
    *   **Issue:** The effect depends on `tournament.matches`. Every time a score updates (e.g. `handleGoal`), `tournament.matches` changes. This triggers a full re-fetch of `liveMatchRepository.getAll()` and metadata sync.
    *   **Fix:** Decouple initial load from updates. Use a strict "mount only" effect or dependency check.

## 3. Bundle Size & Loading Performance
*Status: Completed*

### Strengths
*   **Lazy Loading:** Excellent usage of `React.lazy` in `App.tsx` for all major routes (Dashboard, Wizard, Admin, Public).
*   **Vendor Splitting:** `jspdf` and `jspdf-autotable` are correctly isolated in `vite.config.ts`.

### Improvements
*   **[LOW] Image Compression:** `browser-image-compression` is imported at top-level. Consider dynamic import `await import('browser-image-compression')` inside the upload handler to save initial bundle size (~30KB gzipped).

## 4. Computation & Algorithms
*Status: Completed*

### Findings
*   **Conflict Detection:** `useMatchConflicts` runs O(N²) checks. For typical tournaments (<100 matches), this is negligible (<1ms).
*   **Memoization:** `detectAllConflicts` is correctly memoized.

---

# Action Plan

1.  **Immediate Fix (~1 hour):** Apply `React.memo` to `TeamBlock`, `FoulBar`, `GameControls`, `TimeSlot`, and `DraggableMatch`.
2.  **Stability Fix (~30 mins):** Remove `tournament.matches` dependency from `useMatchExecution` initial load effect.
3.  **Optimization:** Move `browser-image-compression` to dynamic import.
