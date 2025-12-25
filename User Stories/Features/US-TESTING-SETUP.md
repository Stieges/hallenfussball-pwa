# US-TESTING-SETUP: Test-Infrastruktur & Coverage aufbauen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TESTING-SETUP |
| **Priorität** | Critical |
| **Status** | In Progress (Phase 1 Done) |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Code-Qualität / DevOps |
| **Impact** | Sehr Hoch - Grundlage für sichere Weiterentwicklung |
| **Aufwand** | 3-4 Wochen (inkrementell) |

---

## User Story

**Als** Entwickler
**möchte ich** eine umfassende Test-Infrastruktur mit automatisierten Tests
**damit** ich Refactorings und neue Features sicher implementieren kann, ohne Regressionen zu verursachen

---

## Kontext & Auswirkungen

### Aktueller Zustand

- **0% Test-Coverage** - Keine Unit-, Integration- oder E2E-Tests
- **15.000+ Zeilen Code** ohne Absicherung
- **Hohe Regressionsrisiko** bei Änderungen

### Auswirkungen fehlender Tests

| Problem | Auswirkung | Risiko |
|---------|------------|--------|
| Keine Regressionserkennung | Bugs werden erst in Produktion entdeckt | Hoch |
| Angst vor Refactoring | Tech Debt akkumuliert sich | Hoch |
| Lange Debugging-Zeiten | Fehlerursache schwer lokalisierbar | Mittel |
| Keine Dokumentation durch Tests | Verhalten unklar für neue Entwickler | Mittel |
| Keine CI/CD-Integration möglich | Manuelle Deployments fehleranfällig | Mittel |

### Best Practices 2024 (Recherche)

**Framework-Wahl: Vitest vs Jest**

| Kriterium | Vitest | Jest |
|-----------|--------|------|
| Vite-Integration | Native | Zusätzliche Config nötig |
| Geschwindigkeit | Schneller (esbuild) | Langsamer |
| TypeScript | Out-of-the-box | Babel-Konfiguration |
| API-Kompatibilität | Jest-kompatibel | Standard |
| Empfehlung | ✅ Für Vite-Projekte | Für CRA/Next.js |

**Coverage-Ziele**

| Bereich | Empfohlene Coverage | Priorität |
|---------|-------------------|-----------|
| `/lib` (Business Logic) | 80%+ | Kritisch |
| `/utils` (Helper) | 90%+ | Kritisch |
| UI-Komponenten | 60%+ | Hoch |
| Screens | 40%+ | Mittel |

---

## Acceptance Criteria

### Phase 1: Infrastruktur (Woche 1)

1. **AC1:** Given das Projekt, When ich `npm run test` ausführe, Then startet Vitest ohne Fehler.

2. **AC2:** Given Vitest ist konfiguriert, When ich `npm run test:coverage` ausführe, Then wird ein Coverage-Report generiert.

3. **AC3:** Given die CI/CD-Pipeline, When ein PR erstellt wird, Then laufen automatisch alle Tests.

### Phase 2: Core-Tests (Woche 2)

4. **AC4:** Given `/lib/scheduleGenerator.ts`, When ich Tests schreibe, Then ist die Coverage mindestens 70%.

5. **AC5:** Given `/utils/`, When alle Utility-Funktionen getestet sind, Then ist die Coverage mindestens 80%.

6. **AC6:** Given kritische Funktionen (Score-Berechnung, Ranking), Then sind Edge-Cases dokumentiert und getestet.

### Phase 3: Component-Tests (Woche 3-4)

7. **AC7:** Given UI-Komponenten in `/components/ui/`, When getestet, Then ist Coverage mindestens 50%.

8. **AC8:** Given komplexe Komponenten (MatchTimer, ScoreInput), Then sind User-Interaktionen getestet.

### Phase 4: Integration (Optional)

9. **AC9:** Given E2E-Tests mit Playwright/Cypress, When kritische User-Flows getestet werden, Then sind Turnier-Erstellung und Score-Erfassung abgedeckt.

---

## Technische Hinweise

### 1. Vitest Setup

```bash
# Installation
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

### 2. Beispiel: Unit-Test für scheduleGenerator

```typescript
// src/lib/__tests__/scheduleGenerator.test.ts
import { describe, it, expect } from 'vitest'
import { generateSchedule, calculateRoundRobinMatches } from '../scheduleGenerator'
import { createMockTournament } from '../../test/factories'

describe('scheduleGenerator', () => {
  describe('calculateRoundRobinMatches', () => {
    it('should calculate correct number of matches for 8 teams', () => {
      // n * (n-1) / 2 = 8 * 7 / 2 = 28 matches
      const matches = calculateRoundRobinMatches(8)
      expect(matches).toBe(28)
    })

    it('should handle odd number of teams with bye rounds', () => {
      const matches = calculateRoundRobinMatches(7)
      expect(matches).toBe(21) // 7 * 6 / 2
    })
  })

  describe('generateSchedule', () => {
    it('should create valid schedule for tournament', () => {
      const tournament = createMockTournament({
        teamCount: 8,
        groupCount: 2,
        matchDuration: 7,
      })

      const schedule = generateSchedule(tournament)

      expect(schedule.matches).toBeDefined()
      expect(schedule.matches.length).toBeGreaterThan(0)
      expect(schedule.matches.every(m => m.homeTeam && m.awayTeam)).toBe(true)
    })

    it('should not schedule same team twice at same time', () => {
      const tournament = createMockTournament({ teamCount: 8 })
      const schedule = generateSchedule(tournament)

      const timeSlots = groupBy(schedule.matches, 'startTime')

      Object.values(timeSlots).forEach(matches => {
        const teams = matches.flatMap(m => [m.homeTeam, m.awayTeam])
        const uniqueTeams = new Set(teams)
        expect(teams.length).toBe(uniqueTeams.size)
      })
    })
  })
})
```

### 3. Beispiel: Component-Test

```typescript
// src/components/ui/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when loading', () => {
    render(<Button loading>Click me</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies variant styles', () => {
    const { container } = render(<Button variant="danger">Delete</Button>)
    expect(container.firstChild).toHaveStyle({ backgroundColor: expect.stringContaining('red') })
  })
})
```

### 4. Test-Factory Pattern

```typescript
// src/test/factories.ts
import { Tournament, Team, Match } from '../types/tournament'

export function createMockTournament(overrides?: Partial<Tournament>): Tournament {
  return {
    id: 'test-tournament-1',
    name: 'Test Tournament',
    date: '2025-01-01',
    teams: Array.from({ length: 8 }, (_, i) => createMockTeam({ id: `team-${i}` })),
    settings: {
      matchDuration: 7,
      breakDuration: 3,
      groupCount: 2,
    },
    ...overrides,
  }
}

export function createMockTeam(overrides?: Partial<Team>): Team {
  return {
    id: 'team-1',
    name: 'Test Team',
    shortName: 'TT',
    groupId: 'A',
    ...overrides,
  }
}

export function createMockMatch(overrides?: Partial<Match>): Match {
  return {
    id: 'match-1',
    homeTeam: createMockTeam({ id: 'home' }),
    awayTeam: createMockTeam({ id: 'away' }),
    homeScore: null,
    awayScore: null,
    status: 'pending',
    ...overrides,
  }
}
```

### 5. CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
```

---

## Priorisierte Test-Liste

| Priorität | Datei/Modul | Begründung |
|-----------|-------------|------------|
| 1 | `scheduleGenerator.ts` | Kernlogik, komplex, 953 Zeilen |
| 2 | `playoffResolver.ts` | Kritische Logik, 584 Zeilen |
| 3 | `calculateStandings.ts` | Ranking-Berechnung |
| 4 | `utils/` (alle) | Grundlegende Hilfsfunktionen |
| 5 | `Button`, `Input` | Basis-UI-Komponenten |
| 6 | `MatchTimer` | Kritische Live-Funktionalität |
| 7 | `ScoreInput` | User-Interaktion kritisch |

---

## Definition of Done

- [ ] Vitest konfiguriert und lauffähig
- [ ] Coverage-Reporting aktiviert
- [ ] Mindestens 20 Unit-Tests geschrieben
- [ ] `/lib` Coverage ≥ 70%
- [ ] `/utils` Coverage ≥ 80%
- [ ] CI/CD-Pipeline mit Test-Job
- [ ] Test-Factories für Tournament, Team, Match
- [ ] Dokumentation für Test-Patterns

---

## Quellen

- [React Component Testing with Vitest (2025)](https://www.codingeasypeasy.com/blog/react-component-testing-best-practices-with-vitest-and-jest-2025-guide)
- [Vitest Component Testing Guide](https://vitest.dev/guide/browser/component-testing)
- [React Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)
- [Bulletproof React Testing](https://vaskort.medium.com/bulletproof-react-testing-with-vitest-rtl-deeaabce9fef)
