# Admin Center - Umsetzungsplan

**Datum:** 2026-01-05
**Basierend auf:** [ADMIN-CENTER-REVIEW.md](./ADMIN-CENTER-REVIEW.md)

---

## Priorisierung

| Priorität | Issue | Aufwand |
|-----------|-------|---------|
| P1 | Schedule-Actions implementieren | Mittel |
| P1 | Warnings-Widget mit Navigation | Klein |
| P2 | Keyboard-Navigation Sidebar | Mittel |
| P2 | Tablet-Layout implementieren | Mittel |
| P2 | Shared Styles extrahieren | Mittel |
| P3 | Dashboard Quick Actions verbessern | Klein |
| P3 | Mobile Hub Suche | Mittel |
| P3 | Test-Coverage erhöhen | Groß |

---

## Detaillierte Umsetzungsschritte

### Phase 1: Kritische Funktionen (P1)

#### 1.1 Schedule-Actions implementieren

**Datei:** `DangerZone/index.tsx`

**Für `regenerate_schedule`:**
```typescript
case 'regenerate_schedule':
  // Bestehende Spielergebnisse behalten, nur nicht gespielte Matches neu planen
  const completedMatches = tournament.matches.filter(m => m.matchStatus === 'finished');
  const regeneratedMatches = generateSchedule(tournament, { keepCompleted: true });

  onTournamentUpdate({
    ...tournament,
    matches: [...completedMatches, ...regeneratedMatches],
    updatedAt: now,
  });
  break;
```

**Für `reset_schedule`:**
```typescript
case 'reset_schedule':
  // Alle Matches zurücksetzen (Status, Scores, Events)
  const resetMatches = tournament.matches.map(match => ({
    ...match,
    matchStatus: 'scheduled' as const,
    scoreA: undefined,
    scoreB: undefined,
    events: [],
    timerStartTime: null,
    elapsedSecondsAtPause: 0,
  }));

  onTournamentUpdate({
    ...tournament,
    matches: resetMatches,
    updatedAt: now,
  });
  break;
```

**Abhängigkeit:** `generateSchedule` Funktion muss existieren oder importiert werden.

#### 1.2 Warnings-Widget mit Navigation

**Datei:** `AdminSidebar.tsx`

**Änderungen:**
```typescript
interface AdminSidebarProps {
  // ... existing
  onWarningClick?: (warning: AdminWarning) => void;
}

// In render:
{warnings.slice(0, 2).map((warning) => (
  <button
    key={warning.id}
    style={{
      ...styles.warningItem,
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      width: '100%',
      textAlign: 'left',
    }}
    onClick={() => onWarningClick?.(warning)}
  >
    <span>►</span>
    <span>{warning.title}</span>
  </button>
))}
```

**In TournamentAdminCenter.tsx:**
```typescript
const handleWarningClick = useCallback((warning: AdminWarning) => {
  if (warning.targetCategory) {
    handleNavigate(warning.targetCategory);
  }
}, [handleNavigate]);
```

---

### Phase 2: UX Verbesserungen (P2)

#### 2.1 Keyboard-Navigation Sidebar

**Datei:** `AdminSidebar.tsx`

**Roving tabindex Pattern:**
```typescript
import { useState, useCallback, useRef, KeyboardEvent } from 'react';

const [focusedIndex, setFocusedIndex] = useState(0);
const itemsRef = useRef<HTMLButtonElement[]>([]);

const handleKeyDown = useCallback((e: KeyboardEvent, index: number) => {
  const items = itemsRef.current.filter(Boolean);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      const nextIndex = (index + 1) % items.length;
      setFocusedIndex(nextIndex);
      items[nextIndex]?.focus();
      break;
    case 'ArrowUp':
      e.preventDefault();
      const prevIndex = (index - 1 + items.length) % items.length;
      setFocusedIndex(prevIndex);
      items[prevIndex]?.focus();
      break;
    case 'Home':
      e.preventDefault();
      setFocusedIndex(0);
      items[0]?.focus();
      break;
    case 'End':
      e.preventDefault();
      const lastIndex = items.length - 1;
      setFocusedIndex(lastIndex);
      items[lastIndex]?.focus();
      break;
  }
}, []);
```

#### 2.2 Tablet-Layout implementieren

**Datei:** `TournamentAdminCenter.tsx`

**Drawer-Sidebar für Tablet:**
```typescript
const [isSidebarOpen, setIsSidebarOpen] = useState(false);

// Tablet Layout (zwischen Desktop und Mobile)
if (isTablet) {
  return (
    <div style={styles.container}>
      {/* Overlay */}
      {isSidebarOpen && (
        <div
          style={styles.overlay}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Drawer Sidebar */}
      <div style={{
        ...styles.drawerSidebar,
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}>
        <AdminSidebar
          activeCategory={activeCategory}
          onNavigate={(id) => {
            handleNavigate(id);
            setIsSidebarOpen(false);
          }}
          warnings={warnings}
          onBackToTournament={onBackToTournament}
        />
      </div>

      {/* Main Content with Toggle */}
      <div style={styles.mainContent}>
        <AdminHeader
          title={categoryTitle}
          onMenuToggle={() => setIsSidebarOpen(true)}
          onBackToTournament={onBackToTournament}
        />
        {/* ... content */}
      </div>
    </div>
  );
}
```

#### 2.3 Shared Styles extrahieren

**Neue Datei:** `admin.styles.ts`

```typescript
import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const sharedStyles = {
  // Cards
  card: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
  } as CSSProperties,

  // Section titles
  sectionTitle: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  // Stats Grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: cssVars.spacing.md,
  } as CSSProperties,

  // Action Buttons
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,
};
```

---

### Phase 3: Nice-to-have (P3)

#### 3.1 Dashboard Quick Actions verbessern

**Direkte Pause-Funktion:**
```typescript
const handlePauseTournament = useCallback(() => {
  // Bestätigungsdialog
  if (!confirm('Turnier wirklich pausieren?')) return;

  onTournamentUpdate({
    ...tournament,
    status: 'paused', // Erfordert Status-Typ Erweiterung
    updatedAt: new Date().toISOString(),
  });
}, [tournament, onTournamentUpdate]);
```

#### 3.2 Mobile Hub Suche

**Datei:** `AdminMobileHub.tsx`

```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredCategories = useMemo(() => {
  if (!searchQuery.trim()) return ADMIN_CATEGORIES;

  const query = searchQuery.toLowerCase();
  return ADMIN_CATEGORIES.filter(cat =>
    cat.label.toLowerCase().includes(query) ||
    cat.description?.toLowerCase().includes(query)
  );
}, [searchQuery]);
```

#### 3.3 Test-Coverage erhöhen

**Neue Test-Dateien:**
- `src/features/tournament-admin/__tests__/TournamentAdminCenter.test.tsx`
- `src/features/tournament-admin/__tests__/AdminSidebar.test.tsx`
- `src/features/tournament-admin/categories/__tests__/DangerZone.test.tsx`
- `src/features/tournament-admin/categories/__tests__/Dashboard.test.tsx`

**Testfälle für DangerZone:**
1. Dialog öffnet bei Klick auf Action
2. Dialog schließt bei Cancel
3. Confirm-Button disabled bei falschem Text
4. Action wird ausgeführt bei korrektem Confirm-Text
5. Loading-State während Ausführung

---

## Geschätzter Aufwand

| Phase | Geschätzter Aufwand |
|-------|---------------------|
| Phase 1 | 2-3 Stunden |
| Phase 2 | 4-5 Stunden |
| Phase 3 | 4-6 Stunden |
| **Gesamt** | **10-14 Stunden** |

---

## Abhängigkeiten

- Schedule-Regeneration benötigt `generateSchedule` Utility
- Tournament-Status Erweiterung für "paused" Status
- Ansonsten keine externen Abhängigkeiten

---

## Verifikation

Nach Umsetzung:
1. `npm run lint` - 0 Warnings
2. `npm run test` - Alle Tests bestehen
3. `npm run build` - Erfolgreich
4. Manuelle Tests:
   - DangerZone Actions funktionieren
   - Keyboard-Navigation in Sidebar
   - Tablet Drawer öffnet/schließt
   - Warnings-Widget Navigation
   - Quick Actions führen Aktionen direkt aus
