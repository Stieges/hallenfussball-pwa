# US-CUSTOM-HOOKS: Wiederverwendbare Custom Hooks extrahieren

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-CUSTOM-HOOKS |
| **Priorität** | High |
| **Status** | Done |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Code-Qualität / Wiederverwendbarkeit |
| **Impact** | Hoch - Reduziert Duplikation, verbessert Testbarkeit |
| **Aufwand** | 2-3 Tage |

---

## User Story

**Als** Entwickler
**möchte ich** wiederverwendbare Custom Hooks für häufig genutzte Logik haben
**damit** ich duplizierten Code vermeiden und die Testbarkeit verbessern kann

---

## Kontext & Auswirkungen

### Aktueller Zustand ✅ IMPLEMENTIERT

```
src/hooks/
├── useLocalStorage.ts      ✓ Persistente State-Verwaltung
├── useFormPersistence.ts   ✓ Form-Persistenz
├── useMatchTimer.ts        ✓ Timer für Matches
├── useDebounce.ts          ✓ Debounced Values/Callbacks
├── useClickOutside.ts      ✓ Klick außerhalb Element
├── usePrevious.ts          ✓ Previous Value
├── useIsMobile.ts          ✓ Mobile Detection
├── useLiveMatches.ts       ✓ Live Match State
├── useLiveMatchManagement.ts ✓ Match Management
├── useMultiTabSync.ts      ✓ Cross-Tab Synchronization
├── useOnlineStatus.ts      ✓ Online/Offline Detection
├── useTournaments.ts       ✓ Tournament Data
├── useSportConfig.ts       ✓ Sport Configuration
├── useUserProfile.ts       ✓ User Profile
├── usePermissions.ts       ✓ Permission Handling
└── index.ts                ✓ Central Export
```

**Stand: Dezember 2025 - Alle Hooks implementiert und in Verwendung.**

### Auswirkungen fehlender Custom Hooks

| Problem | Auswirkung | Schweregrad |
|---------|------------|-------------|
| Code-Duplikation | Gleiche Logik in mehreren Dateien | Hoch |
| Inkonsistentes Verhalten | Unterschiedliche Implementierungen | Hoch |
| Schwer testbar | Business-Logik in UI-Komponenten | Mittel |
| Maintenance-Last | Änderungen an vielen Stellen nötig | Mittel |
| Bundle Size | Unnötig großer Code | Niedrig |

### Best Practices für Custom Hooks (Recherche 2024)

**Wann einen Custom Hook erstellen?**

> "If a piece of logic is used more than once, or if it makes a component too complex, it's a good candidate for a custom hook."

**Naming Convention**

> "Always start custom hook names with 'use' to follow React conventions and enable ESLint rules for hooks."

**Separation of Concerns**

> "Custom hooks should focus on one specific concern. If a hook does too many things, split it into smaller hooks."

---

## Acceptance Criteria

### Phase 1: Analyse & Identifikation

1. **AC1:** Given die Codebase, When ich duplizierte Logik identifiziere, Then dokumentiere ich alle Kandidaten für Hooks.

2. **AC2:** Given Timer-Logik, When ich sie analysiere, Then ist sie in mindestens 2 Komponenten dupliziert.

### Phase 2: Hook-Erstellung

3. **AC3:** Given `useLocalStorage`, When ich ihn verwende, Then persistiert er Daten automatisch im localStorage.

4. **AC4:** Given `useMatchTimer`, When ich ihn verwende, Then kann ich Timer starten, pausieren und zurücksetzen.

5. **AC5:** Given `useDebounce`, When ich ihn für Input verwende, Then wird die Callback-Funktion verzögert aufgerufen.

6. **AC6:** Given `useMediaQuery`, When ich ihn verwende, Then reagiert er auf Viewport-Änderungen.

### Phase 3: Migration

7. **AC7:** Given alle Timer-Logik, When migriert, Then nutzt sie `useMatchTimer`.

8. **AC8:** Given alle localStorage-Zugriffe, When migriert, Then nutzen sie `useLocalStorage`.

---

## Technische Hinweise

### 1. Hook-Struktur

```
src/hooks/
├── useLocalStorage.ts      # Persistente State-Verwaltung
├── useMatchTimer.ts        # Timer für Matches
├── useDebounce.ts          # Debounced Values
├── useMediaQuery.ts        # Responsive Breakpoints
├── useClickOutside.ts      # Klick außerhalb Element
├── useKeyboard.ts          # Keyboard-Shortcuts
├── useFullscreen.ts        # Fullscreen API
├── usePrevious.ts          # Previous Value
└── index.ts                # Exports
```

### 2. useLocalStorage Hook

```typescript
// src/hooks/useLocalStorage.ts
import { useState, useEffect, useCallback } from 'react'

type SetValue<T> = (value: T | ((prev: T) => T)) => void

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, SetValue<T>, () => void] {
  // Lazy initialization
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Update localStorage when state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        setStoredValue(JSON.parse(e.newValue))
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  const setValue: SetValue<T> = useCallback((value) => {
    setStoredValue(prev => {
      const nextValue = value instanceof Function ? value(prev) : value
      return nextValue
    })
  }, [])

  const remove = useCallback(() => {
    window.localStorage.removeItem(key)
    setStoredValue(initialValue)
  }, [key, initialValue])

  return [storedValue, setValue, remove]
}
```

### 3. useDebounce Hook

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// Callback-Version
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}
```

### 4. useMediaQuery Hook

```typescript
// src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }

    // Legacy browsers
    mediaQuery.addListener(handler)
    return () => mediaQuery.removeListener(handler)
  }, [query])

  return matches
}

// Vordefinierte Breakpoints
export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTV = useMediaQuery('(min-width: 1920px)')

  return { isMobile, isTablet, isDesktop, isTV }
}
```

### 5. useClickOutside Hook

```typescript
// src/hooks/useClickOutside.ts
import { useEffect, RefObject } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current

      // Do nothing if clicking ref's element or descendent elements
      if (!el || el.contains(event.target as Node)) {
        return
      }

      handler(event)
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}
```

### 6. useKeyboard Hook

```typescript
// src/hooks/useKeyboard.ts
import { useEffect, useCallback } from 'react'

type KeyHandler = (event: KeyboardEvent) => void
type KeyMap = Record<string, KeyHandler>

export function useKeyboard(keyMap: KeyMap) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const handler = keyMap[key]

      if (handler) {
        event.preventDefault()
        handler(event)
      }
    },
    [keyMap]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Convenience Hook für einzelne Keys
export function useKeyPress(
  key: string,
  handler: KeyHandler,
  options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase()
      const matchesCtrl = options?.ctrl ? event.ctrlKey : true
      const matchesShift = options?.shift ? event.shiftKey : true
      const matchesAlt = options?.alt ? event.altKey : true

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
        event.preventDefault()
        handler(event)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [key, handler, options])
}
```

### 7. usePrevious Hook

```typescript
// src/hooks/usePrevious.ts
import { useRef, useEffect } from 'react'

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}
```

### 8. Hook Index

```typescript
// src/hooks/index.ts
export { useLocalStorage } from './useLocalStorage'
export { useDebounce, useDebouncedCallback } from './useDebounce'
export { useMediaQuery, useBreakpoint } from './useMediaQuery'
export { useClickOutside } from './useClickOutside'
export { useKeyboard, useKeyPress } from './useKeyboard'
export { usePrevious } from './usePrevious'
export { useMatchTimer } from './useMatchTimer'
export { useFullscreen } from './useFullscreen'
```

---

## Migrations-Plan

### Schritt 1: Hooks erstellen
1. Basis-Hooks erstellen (useLocalStorage, useDebounce, usePrevious)
2. UI-Hooks erstellen (useMediaQuery, useClickOutside)
3. Feature-Hooks erstellen (useMatchTimer, useFullscreen)

### Schritt 2: Tests schreiben
```typescript
// src/hooks/__tests__/useLocalStorage.test.ts
describe('useLocalStorage', () => {
  it('initializes with default value', () => { ... })
  it('persists value to localStorage', () => { ... })
  it('syncs across tabs', () => { ... })
})
```

### Schritt 3: Komponenten migrieren
1. Timer-Komponenten auf useMatchTimer umstellen
2. Dialoge auf useClickOutside umstellen
3. Responsive Logic auf useBreakpoint umstellen

---

## Identifizierte Duplikationen

| Logik | Dateien | Zeilen gespart |
|-------|---------|----------------|
| Timer-Logic | MonitorTab, MatchTimer, TVDisplay | ~150 Zeilen |
| localStorage | 5+ Screens | ~80 Zeilen |
| Debounce | Search, Filters | ~40 Zeilen |
| Click Outside | Dialogs, Dropdowns | ~60 Zeilen |
| Media Query | 10+ Komponenten | ~100 Zeilen |

**Geschätzte Einsparung: ~430 Zeilen Code**

---

## Definition of Done

- [ ] Hook-Struktur unter `/src/hooks/` angelegt
- [ ] `useLocalStorage` implementiert und getestet
- [ ] `useDebounce` implementiert und getestet
- [ ] `useMediaQuery` implementiert und getestet
- [ ] `useClickOutside` implementiert und getestet
- [ ] `useKeyboard` implementiert und getestet
- [ ] `usePrevious` implementiert und getestet
- [ ] Mindestens 3 Komponenten migriert
- [ ] TypeScript ohne `any` Types
- [ ] Dokumentation mit Beispielen

---

## Quellen

- [React Custom Hooks Best Practices](https://www.freecodecamp.org/news/how-to-create-react-hooks/)
- [useHooks.com - Collection of Hooks](https://usehooks.com/)
- [React Docs - Building Your Own Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Custom Hook Patterns 2024](https://blog.bitsrc.io/top-5-react-design-patterns-that-you-should-know-in-2024-5f2696868222)
