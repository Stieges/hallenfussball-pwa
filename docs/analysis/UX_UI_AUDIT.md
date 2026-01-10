# UX/UI & User Flow Audit

**Status:** In Progress
**Scope:** Full Codebase (`src/features/*`)
**Objective:** Identify strengths, weaknesses, and improvement potential with concrete implementation details.

## 1. Onboarding & Tournament Creation (Wizard)
*File Scope:* `src/features/tournament-creation/*`

### Strengths
*   **Smart Defaults:** The `SmartConfig` component in `Step2_ModeAndSystem.tsx` (L279) proactively helps users find valid configurations, reducing "decision paralysis".
*   **Real-time Validation:** `Step4_Teams.tsx` (L30) implements `analyzeGroupDistribution` to give immediate feedback on unbalanced groups or invalid setups.
*   **Design Token Usage:** Consistent use of `cssVars` (e.g., `Step1_SportAndType.tsx` L5) ensures visual consistency.

### Weaknesses
*   **Touch Target Violation in Team List:**
    *   *Location:* `Step4_Teams.tsx`:296 (`width: 40, height: 40`).
    *   *Issue:* The Expand-Button (`▼`) is 40x40px, violating the 44px minimum for comfortable touch interaction.
*   **Cognitive Load in Step 2:**
    *   *Location:* `Step2_ModeAndSystem.tsx`.
    *   *Issue:* Although collapsible, the sheer number of options (7 sections) is overwhelming. The "Advanced Settings" divider (L293) helps, but the page is very long.

### Improvement Potential
*   **[FIX] Enforce 44px Touch Targets:**
    *   *File:* `Step4_Teams.tsx`
    *   *Change:* Increase button size to 44px or add transparent padding.
    *   *Sketch:*
        ```tsx
        // Step4_Teams.tsx
        <button style={{
          minWidth: 44, // Increased from 40
          minHeight: 44,
          // ...
        }}>
        ```
*   **[UX] Step 2 Progressive Disclosure:**
    *   *File:* `Step2_ModeAndSystem.tsx`
    *   *Concept:* Move "Sonderregeln", "Cockpit" and "Schiedsrichter" into a dedicated "Expert Mode" toggle or a separate optional step, to keep the main flow focused on "Mode & Teams".

## 2. Tournament Administration (Dashboard)
*File Scope:* `src/features/tournament-admin/*`

### Strengths
*   **Architecture:** The Hub-and-Spoke model (`TournamentAdminCenter.tsx`) with Lazy Loading (L30-73) ensures fast initial load times.
*   **Resilience:** Every category is wrapped in an `ErrorBoundary` (L321), preventing a single crashed feature from taking down the entire admin interface.
*   **Responsive:** Explicit Mobile/Desktop logic (`isMobile` check L265) provides a tailored experience (Hub on mobile vs. Sidebar on desktop).

### Weaknesses
*   **Style Inconsistency:**
    *   *Location:* `TournamentAdminCenter.tsx` (L79-123).
    *   *Issue:* Styles are defined as a large JS object within the file, mixing `cssVars` with structural layout properties. This makes it harder to maintain compared to CSS Modules or styled components used elsewhere.
*   **Navigation State:**
    *   *Location:* `TournamentAdminCenter.tsx` (L146).
    *   *Issue:* Deep linking relies on manual URL parsing (`location.pathname.split('/')`). This is fragile and could be handled better by React Router's `useParams` or nested routes.

### Improvement Potential
*   **[REFACTOR] Routing modernization:**
    *   *File:* `TournamentAdminCenter.tsx`
    *   *Change:* Switch from manual `split('/')` parsing to nested `<Route>` definitions. This simplifies `activeCategory` state management.
*   **[STYLE] CSS Modules Extraction:**
    *   *File:* `TournamentAdminCenter.tsx`
    *   *Change:* Move the large `styles` object to `TournamentAdminCenter.module.css` to separate concerns and improve readability.

## 3. Schedule Management (Editor)
*File Scope:* `src/features/schedule-editor/*`

### Strengths
*   **User Control:** Local Undo/Redo history (`ScheduleEditor.tsx` L235) gives users confidence to experiment with the schedule sans fear of breaking it.
*   **Performance:** Atomic updates in `handleMoveMatch` (L348) ensure the grid remains responsive even during complex reordering operations.
*   **Feedback:** Visual drag indicators (`TimeSlot.tsx` L78) provide clear state for drop targets.

### Weaknesses
*   **Inline Styles Everywhere:**
    *   *Location:* `DraggableMatch.tsx` (L104-273).
    *   *Issue:* Massive style objects make the component hard to read and modify. CSS Variables are used, but the structure is rigid.
*   **Touch Targets:**
    *   *Location:* `DraggableMatch.tsx` (L261).
    *   *Issue:* The Drag Handle (`⋮⋮`) is hardcoded to `28px` width/height. This is nearly half the recommended 44px for touch interaction, making it hard to grab on mobile.
*   **Accessibility:**
    *   *Location:* `TimeSlot.tsx`
    *   *Issue:* Drop zones are only indicated by color/border change. No explicit text or aria-live announcements for screen readers when a valid drop target is entered.

### Improvement Potential
*   **[FIX] Touch-First Drag Handles:**
    *   *File:* `DraggableMatch.tsx`
    *   *Change:* Increase hit area of the drag handle using padding while keeping the visual icon size.
    *   *Sketch:*
        ```tsx
        const dragHandleStyle = {
          // ...
          width: '44px',  // Min touch target
          height: '44px', // Min touch target
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          // Use negative margin if needed to visual align
        };
        ```
*   **[UX] Keyboard Navigation:**
    *   *File:* `useGridNavigation.ts` (New)
    *   *Concept:* Implement arrow key navigation to move selected match identifiers between slots, enabling accessibility-compliant drag and drop.

## 4. Live Operations (Cockpit)
*File Scope:* `src/features/tournament-management/ManagementTab.tsx`

### Strengths
*   **Safety Nets:** `ConfirmDialog` integration (L76, L84) prevents accidental data loss when switching matches or starting over existing results.
*   **Touch Optimization:** `GameControls/index.tsx` (L73) explicitly defines `minHeight: '44px'` for buttons, adhering to WCAG standards.
*   **State Management:** `useMatchExecution` hook encapsulates complex logic (Undo, Events, Timer), keeping the UI component clean.

### Weaknesses
*   **Hidden Logic:**
    *   *Location:* `ManagementTab.tsx` (L116 `isPlaceholder`).
    *   *Issue:* Logic to determine if a team is a placeholder ("Group A Winner") is hardcoded string matching. This should be a robust model property or utility.
*   **Mockup Dependency:**
    *   *Location:* `ManagementTab.tsx` (L359).
    *   *Issue:* Usage of `LiveCockpitMockup` suggests the UI might be based on a temporary or external design that doesn't fully leverage the internal `Card`/`Button` components, potentially creating visual inconsistency.

### Improvement Potential
*   **[REFACTOR] Component Unification:**
    *   *File:* `LiveCockpitMockup.tsx` -> `LiveCockpit.tsx`
    *   *Concept:* Replace the "Mockup" component with a production-ready component using standard Design System atoms to ensure visual consistency with the rest of the app.
*   **[UX] Context-Aware Header:**
    *   *File:* `ManagementTab.tsx`
    *   *Concept:* When a match is running, the header/navigation should visually indicate "LIVE MODE" (e.g., pulsing badge) to prevent accidental navigation away.

## 5. Public Experience (Public View)
*File Scope:* `src/screens/PublicTournamentViewScreen.tsx`

### Strengths
*   **Resilience:** The data loading strategy (`Supabase` -> Fallback `LocalStorage`) guarantees availability even if the network is flaky (L37-75).
*   **Privacy Compliance:** Explicit methods `getFilteredSchedule` and `getFilteredStandings` ensure "Bambini Mode" adheres to regulations by stripping scores server/client-side before rendering.

### Weaknesses
*   **Styling Fragmentation:**
    *   *Location:* `PublicTournamentViewScreen.tsx` (L161-201).
    *   *Issue:* Another instance of large CSS-in-JS objects instead of proper styling architecture.
*   **Missing Navigation:**
    *   *Location:* `PublicTournamentViewScreen.tsx` (L243).
    *   *Issue:* The header is just a `div` with text. No explicit branding, no "Home" link (if relevant), and no "Refresh" button which is crucial for public displays that might not auto-update via websocket efficiently.

### Improvement Potential
*   **[FEAT] Auto-Refresh / WebSocket:**
    *   *File:* `usePublicTournament.ts` (New hook)
    *   *Concept:* Implement Supabase Realtime subscription to auto-update the view without manual refresh.
*   **[UI] Public Header Component:**
    *   *File:* `src/components/layout/PublicHeader.tsx`
    *   *Concept:* Create a reusable header for all public views (Normal + Live) containing Branding and Last-Updated timestamp.

---

# Executive Summary & Next Steps

The codebase demonstrates **advanced state management** and **robust error handling**. The core logic for tournament management is solid.

**Critical UX Priorities:**
1.  **Touch Targets:** Fix `DraggableMatch` (Schedule Editor) and `Step4_Teams` (Wizard) immediately to meet mobile usability standards.
2.  **Visual Feedback:** Implement the planned "Swap vs. Move" indicators in Schedule Editor.
3.  **Consistency:** Refactor `ManagementTab` (Cockpit) to use standard UI components instead of `Mockup` wrappers.

**Technical Debt:**
*   Migrate large `const style = {}` objects in Page components to CSS Modules or styled components to improve maintainability and performance.
