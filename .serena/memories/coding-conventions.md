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
3. Theme-System nutzen: `theme.colors.primary`, `theme.spacing.md`

### Theme-Verwendung
```typescript
import { theme } from '../styles/theme'

const style = {
  color: theme.colors.text.primary,
  padding: theme.spacing.md,
  borderRadius: theme.borderRadius.md,
}
```

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
