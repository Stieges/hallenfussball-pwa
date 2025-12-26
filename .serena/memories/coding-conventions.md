# Coding Conventions - Hallenfußball PWA

## TypeScript

### Imports
```typescript
// 1. React imports
import { useState, useEffect, useCallback } from 'react'

// 2. Third-party libraries
import { jsPDF } from 'jspdf'

// 3. Internal types
import { Tournament, Match, Team } from '../types/tournament'

// 4. Internal components/utils
import { Button, Card } from '../components/ui'
import { formatTime } from '../lib/scheduleHelpers'
```

### Naming
- **Components**: PascalCase (`TournamentCard.tsx`)
- **Hooks**: camelCase mit `use` Prefix (`useDebounce.ts`)
- **Utils/Helpers**: camelCase (`formatTime`, `calculateStandings`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_TEAMS`, `DEFAULT_DURATION`)
- **Types/Interfaces**: PascalCase (`Tournament`, `MatchStatus`)

### Types
- Immer explizite Types verwenden
- Keine `any` außer in absoluten Ausnahmen
- Props-Interfaces mit `Props` Suffix: `TournamentCardProps`
- State-Interfaces mit `State` Suffix: `TournamentState`

## React Patterns

### Komponenten-Struktur
```typescript
// 1. Imports
// 2. Types/Interfaces
// 3. Constants
// 4. Helper functions (wenn klein)
// 5. Component
// 6. Styles (wenn inline)
// 7. Export
```

### Hooks Reihenfolge in Komponenten
```typescript
function MyComponent() {
  // 1. Context hooks
  const { tournament } = useTournament()
  
  // 2. State hooks
  const [isOpen, setIsOpen] = useState(false)
  
  // 3. Refs
  const inputRef = useRef<HTMLInputElement>(null)
  
  // 4. Derived state / useMemo
  const sortedTeams = useMemo(() => ..., [teams])
  
  // 5. Callbacks / useCallback
  const handleClick = useCallback(() => ..., [])
  
  // 6. Effects
  useEffect(() => ..., [])
  
  // 7. Render
  return (...)
}
```

### Event Handler Naming
- `handle` Prefix: `handleClick`, `handleSubmit`, `handleScoreChange`
- Für Callbacks als Props: `on` Prefix: `onClick`, `onSubmit`, `onScoreChange`

## Styling

### Priorität
1. CSS Modules (`.module.css`) für komplexe Styles
2. Inline styles für einfache/dynamische Styles
3. **Design Tokens nutzen** (siehe unten)

### ⚠️ WICHTIG: Design Tokens verwenden

**Alle Farben, Abstände, Schriftgrößen etc. MÜSSEN über Design Tokens definiert werden.**

```typescript
// ✅ RICHTIG: Direkt aus design-tokens importieren
import { colors, spacing, fontSizes, borderRadius } from '../design-tokens';

const style = {
  color: colors.textPrimary,
  padding: spacing.md,
  fontSize: fontSizes.md,
  borderRadius: borderRadius.md,
};
```

```typescript
// ❌ FALSCH: Hardcoded Werte
const style = {
  color: '#ffffff',        // ❌ Hardcoded
  padding: '16px',         // ❌ Hardcoded
  fontSize: '14px',        // ❌ Hardcoded
  borderRadius: '8px',     // ❌ Hardcoded
};
```

```typescript
// ⚠️ VERALTET: theme.ts (nur für Legacy-Code)
import { theme } from '../styles/theme';  // ⚠️ Deprecated
```

### Verfügbare Design Tokens

| Token | Import | Beispiel |
|-------|--------|----------|
| Farben | `colors` | `colors.primary`, `colors.surface`, `colors.textPrimary` |
| Abstände | `spacing` | `spacing.xs` (4px), `spacing.sm` (8px), `spacing.md` (16px) |
| Schriftgrößen | `fontSizes` | `fontSizes.sm` (12px), `fontSizes.md` (14px), `fontSizes.lg` (16px) |
| Border Radius | `borderRadius` | `borderRadius.sm` (4px), `borderRadius.md` (8px) |
| Schatten | `shadows` | `shadows.sm`, `shadows.md`, `shadows.lg` |
| Animationen | `durations`, `easings` | `durations.fast`, `easings.standard` |

### 8pt Grid System

Alle Abstände basieren auf dem 8pt Grid:
- `spacing.xs` = 4px (Halb-Einheit)
- `spacing.sm` = 8px (1×)
- `spacing.md` = 16px (2×)
- `spacing.lg` = 24px (3×)
- `spacing.xl` = 32px (4×)
- `spacing.xxl` = 48px (6×)

## Verbotene Patterns

### ❌ NIEMALS
- Hart-codierte Turnier-/Team-Namen
- `any` Type ohne Kommentar
- Inline-Styles für komplexe wiederkehrende Patterns
- Console.log in Production (nur in Entwicklung)
- Direkte localStorage Zugriffe außerhalb von Hooks

### ⚠️ VERMEIDEN
- Props Drilling über mehr als 2 Ebenen → Context nutzen
- Komponenten > 300 Zeilen → Aufteilen
- Mehr als 5 useState in einer Komponente → useReducer
- Wiederholte Logik → Custom Hook extrahieren

## Dokumentation

### Wann dokumentieren?
- Neue Dateien/Komponenten: JSDoc Header
- Komplexe Algorithmen: Inline-Kommentare
- Public APIs: JSDoc mit Beispielen
- Architektur-Entscheidungen: CODE_INDEX.md

### JSDoc Format
```typescript
/**
 * Berechnet die Spielplan-Zeiten für alle Matches
 * 
 * @param tournament - Das Turnier-Objekt
 * @param startTime - Startzeit des ersten Spiels
 * @returns GeneratedSchedule mit allen Uhrzeiten
 */
export function generateFullSchedule(
  tournament: Tournament,
  startTime: Date
): GeneratedSchedule
```
