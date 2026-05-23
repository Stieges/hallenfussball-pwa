# Clean-Architecture-Layering

> Dependency-Regeln zwischen den Top-Level-Folders unter `src/`.
> Teilweise via ESLint `no-restricted-imports` enforced — der Rest ist
> manueller Review-Punkt bis die Architektur-Semantik geklärt ist.

---

## Enforced (Status 2026-05-23)

### ✅ `core/` ist framework-free — **error**

```ts
// Verboten in src/core/**:
import React from 'react';                   // → error
import { useAuth } from '../features/auth';  // → error
import { useFoo } from '../hooks/useFoo';    // → error
import Button from '../components/Button';   // → error
```

**Rationale:** core/ ist pure business logic. Wenn dort React/UI gebraucht wird,
ist die Schicht falsch. Eine bewusste Ausnahme (RepositoryContext) ist mit
`// eslint-disable-next-line no-restricted-imports -- TODO(layering): ...`
markiert und als Cleanup-Task vermerkt.

## Nicht enforced (offen)

### ❓ `components/` → `features/`
- Aktuell 4 bestehende Imports (z.B. `components/OfflineBanner` → `features/auth/useAuth`)
- Frage: ist `useAuth` ein generischer Hook oder Feature-spezifisch?

### ❓ `hooks/` → `features/`, `hooks/` → `components/`
- 3 bestehende Imports
- Frage: gehören Toast/AuthContext in `hooks/`, `core/`, oder bleiben sie wo sie sind?

### ❓ `features/<X>` → `features/<Y>`
- Manuelle Review-Pflicht
- Mit statischen Patterns nicht ohne false-positives ausdrückbar
  (`src/screens/` orchestriert features, das ist erwünscht)
- Frage: sind features echte Bounded Contexts oder Komponenten-Module?

---

## Offene Architektur-Entscheidung

**Was ist die Semantik von `src/features/`?**

Aktueller Stand:
- 6 Folders: `auth/`, `tournament-creation/`, `tournament-management/`,
  `schedule-editor/`, `monitor-display/`, `settings/`
- `src/screens/` bindet sie als Tab-Container ein
- Manche (auth) werden in vielen Orten konsumiert (Hook-artig)
- Manche (tournament-creation Wizard) sind klar abgeschlossene Module

Möglichkeiten:
- **Module/Reuse-Units** → Cross-Import ist OK, keine Boundary-Pflicht
- **Bounded Contexts** → Strikt isoliert, 7 Cleanups als HP-Backlog
- **Mixed** → pro Folder unterschiedlich (auth = Modul, tournament-creation = Feature)

**Bis das geklärt ist:** keine automatisierte Boundary-Lint außerhalb core/.

---

## ESLint-Konfiguration

Aktuelle Regeln in `eslint.config.js`:

```js
// Globale Regel: keine cross-folder Pattern (zu false-positive-anfällig)

// File-spezifisch für core/:
{
  files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/features/**'],   message: '...' },
        { group: ['**/hooks/**'],      message: '...' },
        { group: ['**/components/**'], message: '...' },
        { group: ['react', 'react-dom', 'react/*'], message: '...' },
      ],
    }],
  },
}
```

## Bekannte Verstöße (HP-Backlog, falls Bounded-Context-Modell)

### components/ → features/auth, features/schedule-editor (7 Stellen)
```
src/components/OfflineBanner.tsx:15           → features/auth/hooks/useAuth
src/components/OfflineModeIndicator.tsx:17    → features/auth/hooks/useAuth
src/components/schedule/GroupStageSchedule.tsx:37 → features/schedule-editor/hooks/useMatchConflicts
src/components/schedule/SortableMobileCard.tsx:18 → features/schedule-editor/types
src/components/schedule/SortableDesktopCard.tsx:17 → features/schedule-editor/types
src/components/layout/AuthSection.tsx:21      → features/auth/hooks/useAuth
src/components/layout/AuthSection.tsx:23      → features/auth/components/MobileAuthBottomSheet
```

### hooks/ → features/, components/
```
src/hooks/useInitialSync.ts:2                 → features/auth/hooks/useAuth
src/hooks/useAuthTimeoutToast.ts:14           → components/ui/Toast/ToastContext
src/hooks/useMatchExecution.ts:20             → components/ui/Toast/ToastContext
```

### core/ → react (mit bewusstem Disable)
```
src/core/contexts/RepositoryContext.tsx:1     → react (// eslint-disable-next-line ... TODO migrate to hooks/)
```

## Verbindung zur Architektur-Doku

- `docs/architecture/CODE_INDEX.md` — wo ist welcher Layer implementiert
- (lokal) `.claude/CLAUDE.md.bak.2026-05-23` — voller Vision/Architektur-Kontext der getrimmten CLAUDE.md
