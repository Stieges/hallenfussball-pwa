# UX/UI Audit – Umsetzung (Abgeschlossen)

**Datum:** 2026-01-10
**Durchgeführt von:** Claude Code
**Audit-Quelle:** Externes UX/UI Audit + Interne Validierung

---

## Zusammenfassung

| Phase | Beschreibung | Status | Commit |
|-------|--------------|--------|--------|
| **Phase 1** | Touch Targets WCAG 44px | ✅ Erledigt | `268c52c` |
| **Phase 2** | DnD Accessibility Announcements | ✅ Erledigt | `c14917d` |
| **Phase 3** | URL-Parsing modernisieren | ✅ Erledigt | `967f7ff` |
| **Phase 4** | Styling-Vereinheitlichung | ⏭️ Verschoben (Optional) | – |

**Ergebnis:** 3 von 4 Phasen implementiert. Phase 4 als Low-Priority für späteres Refactoring markiert.

---

## Phase 1: Touch Targets (WCAG Compliance)

### Änderungen

#### 1.1 DraggableMatch.tsx – Drag Handle
| Vorher | Nachher |
|--------|---------|
| `28px × 28px` | `44px × 44px` |

**Datei:** [DraggableMatch.tsx:261-273](../src/features/schedule-editor/components/DraggableMatch.tsx#L261-L273)

```typescript
const dragHandleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',      // War: 28px
  height: '44px',     // War: 28px
  minWidth: '44px',   // NEU: Verhindert Schrumpfen in Flex
  minHeight: '44px',  // NEU: Verhindert Schrumpfen in Flex
  // ...
};
```

#### 1.2 Step4_Teams.tsx – Expand Button
| Vorher | Nachher |
|--------|---------|
| `40px × 40px` | `44px × 44px` |

**Datei:** [Step4_Teams.tsx:294-313](../src/features/tournament-creation/Step4_Teams.tsx#L294-L313)

```typescript
<button
  type="button"
  onClick={() => toggleExpanded(team.id)}
  style={{
    flexShrink: 0,
    width: 44,        // War: 40
    height: 44,       // War: 40
    minWidth: 44,     // NEU
    minHeight: 44,    // NEU
    // ...
  }}
>
```

### Referenz
- WCAG 2.1 SC 2.5.5: Target Size (Enhanced) – 44×44 CSS pixels

---

## Phase 2: DnD Accessibility Announcements

### Änderungen

**Datei:** [ScheduleEditor.tsx](../src/features/schedule-editor/ScheduleEditor.tsx)

#### Neue Announcements (Screenreader-Support)
```typescript
import { DndContext, closestCenter, DragOverlay, Announcements } from '@dnd-kit/core';

const announcements: Announcements = useMemo(() => {
  const getMatchLabel = (matchId: string | number): string => { ... };
  const getSlotLabel = (slotId: string | number): string => { ... };

  return {
    onDragStart({ active }) {
      return `${getMatchLabel(active.id)} wird gezogen. Nutze Pfeiltasten zum Verschieben.`;
    },
    onDragOver({ active, over }) {
      if (over) {
        return `${getMatchLabel(active.id)} über ${getSlotLabel(over.id)}`;
      }
      return undefined;
    },
    onDragEnd({ active, over }) {
      if (over) {
        return `${getMatchLabel(active.id)} wurde auf ${getSlotLabel(over.id)} verschoben.`;
      }
      return `Verschieben von ${getMatchLabel(active.id)} abgebrochen.`;
    },
    onDragCancel({ active }) {
      return `Verschieben von ${getMatchLabel(active.id)} abgebrochen.`;
    },
  };
}, [tournament.matches, tournament.teams]);
```

#### DndContext Accessibility Integration
```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragCancel={handleDragCancel}
  accessibility={{
    announcements,
    screenReaderInstructions: {
      draggable: 'Drücke Leertaste um das Spiel zu greifen. ' +
                 'Nutze Pfeiltasten zum Verschieben, ' +
                 'Leertaste zum Ablegen, Escape zum Abbrechen.',
    },
  }}
>
```

### Referenz
- @dnd-kit Accessibility: https://docs.dndkit.com/api-documentation/accessibility

---

## Phase 3: URL-Parsing modernisieren

### Problem
Fragiles URL-Parsing mit `split('/')` und `indexOf` in TournamentAdminCenter.tsx:
```typescript
// VORHER (fragil)
const pathParts = location.pathname.split('/');
const adminIndex = pathParts.indexOf('admin');
const categoryFromUrl = adminIndex >= 0 ? pathParts[adminIndex + 1] : undefined;
```

### Lösung
Kategorie wird zentral in App.tsx extrahiert und als Prop übergeben (Single Source of Truth):

**App.tsx:**
```typescript
// Kategorie wird bereits durch Regex extrahiert
const adminMatch = location.pathname.match(/^\/tournament\/([a-zA-Z0-9-]+)\/admin(?:\/([a-z-]+))?$/);
const adminCategory = adminMatch?.[2];

// Als Prop übergeben
<TournamentAdminCenter
  tournamentId={adminTournamentId}
  initialCategory={adminCategory}
  onBackToTournament={...}
/>
```

**TournamentAdminCenter.tsx:**
```typescript
interface TournamentAdminCenterProps {
  tournamentId: string;
  initialCategory?: string;  // NEU
  onBackToTournament: () => void;
}

export function TournamentAdminCenter({
  tournamentId,
  initialCategory,
  onBackToTournament,
}: TournamentAdminCenterProps) {
  // Category from URL is now passed as prop from App.tsx (single source of truth)
  const categoryFromUrl = initialCategory;
  // ...
}
```

### Entfernte Imports
- `useLocation` (nicht mehr benötigt in TournamentAdminCenter)

---

## Phase 4: Styling-Vereinheitlichung (Zurückgestellt)

### Status
Als **Low-Priority (P3)** für späteres Refactoring markiert.

### Begründung
- Design Tokens (`cssVars.*`) werden bereits konsistent verwendet
- Keine hardcoded Hex-Werte in den betroffenen Dateien
- Inline Styles vs CSS Modules ist ein Architektur-Thema, kein Bug
- Aufwand (4-8h) vs Impact rechtfertigt keine sofortige Umsetzung

### Betroffene Dateien (für späteres Refactoring)
- `TournamentAdminCenter.tsx` – ~45 Zeilen Inline Styles
- `DraggableMatch.tsx` – ~170 Zeilen Inline Styles
- `PublicTournamentViewScreen.tsx` – ~40 Zeilen Inline Styles

---

## Test-Ergebnisse

Alle Tests bestanden nach jeder Phase:
- **440 Tests passed** (1 skipped)
- **Build erfolgreich**
- **Lint ohne Warnings**

---

## Commits

```
967f7ff refactor(routing): eliminate duplicate URL parsing in TournamentAdminCenter
c14917d feat(a11y): add screen reader announcements for drag and drop
268c52c fix(a11y): increase touch targets to WCAG 44px minimum
```

---

## Offene Punkte (für Backlog)

1. **Styling-Vereinheitlichung (P3)** – Bei nächstem größeren Refactoring angehen
2. **React Router useParams** – Langfristig komplett auf Route-basierte Navigation umstellen

---

*Erstellt: 2026-01-10*
