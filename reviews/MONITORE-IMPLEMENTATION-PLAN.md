# Monitore - Umsetzungsplan

**Datum:** 2026-01-05
**Basierend auf:** [MONITORE-REVIEW.md](./MONITORE-REVIEW.md)

---

## Priorisierung

| Priorität | Issue | Aufwand |
|-----------|-------|---------|
| P1 | ARIA-Labels für Buttons | Klein |
| P2 | Loading-Indicator hinzufügen | Klein |
| P2 | Monitor-Name Validierung | Klein |
| P2 | Styles außerhalb Komponente | Mittel |
| P3 | SlideConfigEditor memoizen | Klein |
| P3 | Fokus-Management implementieren | Mittel |
| P3 | Drag-and-Drop für Slides | Groß |
| P3 | Test-Coverage erhöhen | Groß |

---

## Detaillierte Umsetzungsschritte

### Phase 1: Quick Wins (P1)

#### 1.1 ARIA-Labels für MonitorCard Buttons

**Datei:** `MonitorsConfigTab.tsx`

**Änderungen:**
```typescript
<button
  style={actionButtonStyle('primary')}
  onClick={onEdit}
  aria-label={`Monitor "${monitor.name}" bearbeiten`}
>
  ✏️ Bearbeiten
</button>

<button
  style={actionButtonStyle()}
  onClick={onOpenDisplay}
  aria-label={`Monitor "${monitor.name}" in neuem Tab öffnen`}
>
  🖥️ Öffnen
</button>

<button
  style={actionButtonStyle()}
  onClick={onCopyUrl}
  aria-label={isCopied ? 'URL kopiert' : `URL für Monitor "${monitor.name}" kopieren`}
>
  {isCopied ? '✓ Kopiert!' : '🔗 URL kopieren'}
</button>
```

---

### Phase 2: Wichtige Verbesserungen (P2)

#### 2.1 Loading-Indicator hinzufügen

**Datei:** `MonitorEditor.tsx`

**Neue Komponente am Anfang des Content-Bereichs:**
```typescript
{/* Loading Overlay */}
{isLoading && (
  <div style={{
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  }}>
    <div style={{
      padding: cssVars.spacing.lg,
      background: cssVars.colors.surface,
      borderRadius: cssVars.borderRadius.lg,
      color: cssVars.colors.textPrimary,
    }}>
      Speichern...
    </div>
  </div>
)}
```

#### 2.2 Monitor-Name Validierung

**Datei:** `MonitorsConfigTab.tsx`

**Validierungslogik hinzufügen:**
```typescript
const MAX_MONITOR_NAME_LENGTH = 50;

const validateMonitorName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name ist erforderlich';
  }
  if (trimmed.length > MAX_MONITOR_NAME_LENGTH) {
    return `Name darf maximal ${MAX_MONITOR_NAME_LENGTH} Zeichen haben`;
  }
  // Prüfe auf Duplikate
  if (monitors.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
    return 'Ein Monitor mit diesem Namen existiert bereits';
  }
  return null;
};

const handleCreate = async () => {
  const validationError = validateMonitorName(newMonitorName);
  if (validationError) {
    setError(validationError);
    return;
  }
  // ... rest
};
```

#### 2.3 Styles außerhalb Komponente definieren

**Refactoring-Strategie:**

1. Erstelle `MonitorsConfigTab.styles.ts`:
```typescript
import { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

export const styles = {
  container: {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.background,
    minHeight: 'calc(100vh - 200px)',
  } as CSSProperties,
  // ... alle anderen Styles
};

// Dynamische Styles als Funktionen
export const getActionButtonStyle = (
  variant: 'primary' | 'secondary' | 'danger' = 'secondary'
): CSSProperties => ({
  // ...
});
```

2. Import in Komponente:
```typescript
import { styles, getActionButtonStyle } from './MonitorsConfigTab.styles';
```

---

### Phase 3: Nice-to-have (P3)

#### 3.1 SlideConfigEditor memoizen

**Datei:** `MonitorEditor.tsx`

```typescript
import { memo } from 'react';

const SlideConfigEditor = memo(function SlideConfigEditor({
  slide,
  fields,
  groups,
  sponsors,
  onUpdate,
  getFieldDisplayName,
  styles,
}: SlideConfigEditorProps) {
  // ... existing implementation
});
```

#### 3.2 Fokus-Management implementieren

**Datei:** `MonitorEditor.tsx`

```typescript
// Ref für den auslösenden Button
const triggerRef = useRef<HTMLButtonElement | null>(null);

// In handleClose:
const handleClose = useCallback(() => {
  onClose();
  // Fokus zurück zum Trigger
  setTimeout(() => {
    triggerRef.current?.focus();
  }, 0);
}, [onClose]);
```

**Datei:** `MonitorsConfigTab.tsx`

```typescript
// Ref für jeden Edit-Button speichern
const editButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

<button
  ref={(el) => el && editButtonRefs.current.set(monitor.id, el)}
  onClick={() => handleEdit(monitor.id)}
>
  ✏️ Bearbeiten
</button>
```

#### 3.3 Drag-and-Drop für Slides

**Dependencies:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Implementierung:**
1. SortableContext um Slides-Liste
2. SortableSlideItem als Wrapper für jeden Slide
3. DragEndHandler ruft `reorderSlides` auf

#### 3.4 Test-Coverage erhöhen

**Neue Test-Dateien:**
- `src/features/tournament-management/__tests__/MonitorsConfigTab.test.tsx`
- `src/features/tournament-management/__tests__/MonitorEditor.test.tsx`
- `src/hooks/__tests__/useMonitors.test.ts`

**Testfälle für useMonitors:**
1. createMonitor erstellt Monitor korrekt
2. updateMonitor aktualisiert nur geänderte Felder
3. deleteMonitor entfernt Monitor aus Liste
4. duplicateMonitor kopiert alle Slides
5. reorderSlides sortiert korrekt

---

## Geschätzter Aufwand

| Phase | Geschätzter Aufwand |
|-------|---------------------|
| Phase 1 | 30 Minuten |
| Phase 2 | 2-3 Stunden |
| Phase 3 | 6-8 Stunden |
| **Gesamt** | **8-11 Stunden** |

---

## Abhängigkeiten

- Phase 3.3 (Drag-and-Drop) benötigt @dnd-kit Package
- Ansonsten keine externen Abhängigkeiten

---

## Verifikation

Nach Umsetzung:
1. `npm run lint` - 0 Warnings
2. `npm run test` - Alle Tests bestehen
3. `npm run build` - Erfolgreich
4. Manuelle Tests:
   - Monitor erstellen, bearbeiten, löschen
   - Slides hinzufügen, umordnen, konfigurieren
   - URL kopieren funktioniert
   - Keyboard-Navigation (Tab, Escape)
