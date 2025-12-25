# US-REFACTOR-MONITOR: MonitorTab God Component aufteilen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-REFACTOR-MONITOR |
| **Priorität** | Critical |
| **Status** | Open |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Code-Qualität / Refactoring |
| **Impact** | Sehr Hoch - Wartbarkeit & Testbarkeit |
| **Aufwand** | 2-3 Tage |

---

## User Story

**Als** Entwickler
**möchte ich** die MonitorTab-Komponente (1.206 Zeilen) in kleinere, fokussierte Module aufteilen
**damit** der Code wartbar, testbar und verständlich wird

---

## Kontext & Auswirkungen

### Aktueller Zustand

```
MonitorTab.tsx
├── 1.206 Zeilen Code (empfohlen: max 250-300)
├── Timer-Logik
├── Score-Anzeige
├── TV-Modus
├── Match-Navigation
├── Sound-Effekte
├── Fullscreen-Handling
└── 15+ useState Hooks
```

### Auswirkungen von God Components

| Problem | Auswirkung | Schweregrad |
|---------|------------|-------------|
| Schwer verständlich | Neue Entwickler brauchen Stunden zum Einarbeiten | Hoch |
| Schwer testbar | Zu viele Abhängigkeiten für Unit-Tests | Hoch |
| Merge-Konflikte | Jede Änderung betrifft dieselbe Datei | Mittel |
| Performance | Jeder State-Change rendert 1.200 Zeilen neu | Mittel |
| Wiederverwendbarkeit | Timer-Logik kann nicht anderswo genutzt werden | Mittel |

### Best Practices für Refactoring (Recherche)

**Compound Component Pattern**
> "Instead of building monolithic components, you split them into smaller, self-contained components that share state and behavior."

**Custom Hooks für State Extraction**
> "Split view and non-view code into separate places. Views are changing more frequently than non-view logic."

**Praktischer Ansatz**
> "The first thing I do is write a few tests if there are none. Remember, refactoring is the process of changing your code's design, without altering its behavior."

---

## Acceptance Criteria

### Phase 1: Vorbereitung

1. **AC1:** Given MonitorTab.tsx, When ich Tests schreibe, Then sind kritische Funktionen (Timer, Score) abgedeckt.

2. **AC2:** Given die bestehende Funktionalität, When ich refactore, Then ändert sich das Verhalten nicht (Snapshot-Tests).

### Phase 2: Extraktion

3. **AC3:** Given Timer-Logik, When extrahiert zu `useMatchTimer` Hook, Then ist der Hook unabhängig testbar.

4. **AC4:** Given Score-Anzeige, When extrahiert zu `LiveScore` Komponente, Then hat sie max. 150 Zeilen.

5. **AC5:** Given TV-Modus, When extrahiert zu `TVDisplay` Komponente, Then ist sie eigenständig nutzbar.

6. **AC6:** Given MonitorTab nach Refactoring, Then hat sie max. 300 Zeilen.

### Phase 3: Qualität

7. **AC7:** Given alle extrahierten Module, When getestet, Then ist Coverage ≥ 60%.

8. **AC8:** Given TypeScript, When ich die Types prüfe, Then gibt es keine `any` Typen.

---

## Technische Hinweise

### 1. Zielstruktur

```
src/features/tournament-management/
├── MonitorTab.tsx              # 200-250 Zeilen (Container)
├── components/
│   ├── LiveScore.tsx           # Score-Anzeige (100 Zeilen)
│   ├── MatchTimer.tsx          # Timer-UI (80 Zeilen)
│   ├── TeamDisplay.tsx         # Team-Namen & Logos (60 Zeilen)
│   ├── TVDisplay.tsx           # TV-Modus Layout (150 Zeilen)
│   ├── MatchNavigation.tsx     # Vor/Zurück Buttons (50 Zeilen)
│   └── SoundControls.tsx       # Sound-Effekte (40 Zeilen)
├── hooks/
│   ├── useMatchTimer.ts        # Timer-Logik (80 Zeilen)
│   ├── useFullscreen.ts        # Fullscreen API (40 Zeilen)
│   └── useSoundEffects.ts      # Audio-Handling (50 Zeilen)
└── index.ts                    # Exports
```

### 2. Custom Hook: useMatchTimer

```typescript
// src/features/tournament-management/hooks/useMatchTimer.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseMatchTimerOptions {
  duration: number      // Match-Dauer in Sekunden
  onComplete?: () => void
  autoStart?: boolean
}

interface UseMatchTimerReturn {
  time: number
  isRunning: boolean
  isPaused: boolean
  isComplete: boolean
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setTime: (seconds: number) => void
  formattedTime: string
}

export function useMatchTimer(options: UseMatchTimerOptions): UseMatchTimerReturn {
  const { duration, onComplete, autoStart = false } = options

  const [time, setTime] = useState(0)
  const [isRunning, setIsRunning] = useState(autoStart)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const isComplete = time >= duration

  // Timer-Tick
  useEffect(() => {
    if (!isRunning || isPaused || isComplete) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTime(prev => {
        const newTime = prev + 1
        if (newTime >= duration) {
          onComplete?.()
          return duration
        }
        return newTime
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, isPaused, isComplete, duration, onComplete])

  const start = useCallback(() => {
    setIsRunning(true)
    setIsPaused(false)
  }, [])

  const pause = useCallback(() => {
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    setIsPaused(false)
  }, [])

  const reset = useCallback(() => {
    setTime(0)
    setIsRunning(false)
    setIsPaused(false)
  }, [])

  const formattedTime = formatTime(time)

  return {
    time,
    isRunning,
    isPaused,
    isComplete,
    start,
    pause,
    resume,
    reset,
    setTime,
    formattedTime,
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
```

### 3. Komponente: LiveScore

```typescript
// src/features/tournament-management/components/LiveScore.tsx
import React from 'react'
import { Match } from '../../../types/tournament'

interface LiveScoreProps {
  match: Match
  onScoreChange?: (team: 'home' | 'away', delta: number) => void
  readonly?: boolean
  size?: 'normal' | 'large' | 'tv'
}

export const LiveScore: React.FC<LiveScoreProps> = ({
  match,
  onScoreChange,
  readonly = false,
  size = 'normal',
}) => {
  const scoreSize = {
    normal: '2rem',
    large: '3rem',
    tv: '6rem',
  }[size]

  return (
    <div className="live-score" style={{ fontSize: scoreSize }}>
      <ScoreButton
        score={match.homeScore ?? 0}
        onChange={(delta) => onScoreChange?.('home', delta)}
        disabled={readonly}
      />
      <span className="separator">:</span>
      <ScoreButton
        score={match.awayScore ?? 0}
        onChange={(delta) => onScoreChange?.('away', delta)}
        disabled={readonly}
      />
    </div>
  )
}

interface ScoreButtonProps {
  score: number
  onChange: (delta: number) => void
  disabled?: boolean
}

const ScoreButton: React.FC<ScoreButtonProps> = ({ score, onChange, disabled }) => (
  <div className="score-control">
    {!disabled && (
      <button onClick={() => onChange(-1)} disabled={score <= 0}>-</button>
    )}
    <span className="score-value">{score}</span>
    {!disabled && (
      <button onClick={() => onChange(1)}>+</button>
    )}
  </div>
)
```

### 4. Komponente: MatchTimer

```typescript
// src/features/tournament-management/components/MatchTimer.tsx
import React from 'react'
import { useMatchTimer } from '../hooks/useMatchTimer'

interface MatchTimerProps {
  matchId: string
  duration: number
  onComplete?: () => void
  size?: 'normal' | 'large' | 'tv'
}

export const MatchTimer: React.FC<MatchTimerProps> = ({
  matchId,
  duration,
  onComplete,
  size = 'normal',
}) => {
  const timer = useMatchTimer({ duration, onComplete })

  const fontSize = {
    normal: '1.5rem',
    large: '2rem',
    tv: '4rem',
  }[size]

  return (
    <div className="match-timer" style={{ fontSize }}>
      <div className="time-display">
        {timer.formattedTime}
      </div>

      <div className="timer-controls">
        {!timer.isRunning && !timer.isPaused && (
          <button onClick={timer.start}>Start</button>
        )}

        {timer.isRunning && !timer.isPaused && (
          <button onClick={timer.pause}>Pause</button>
        )}

        {timer.isPaused && (
          <button onClick={timer.resume}>Resume</button>
        )}

        {(timer.isRunning || timer.isPaused) && (
          <button onClick={timer.reset}>Reset</button>
        )}
      </div>

      {timer.isComplete && (
        <div className="timer-complete">Match beendet!</div>
      )}
    </div>
  )
}
```

### 5. Refactored MonitorTab (Container)

```typescript
// src/features/tournament-management/MonitorTab.tsx (Ziel: 200-250 Zeilen)
import React, { useState, useCallback } from 'react'
import { Tournament, Match } from '../../types/tournament'
import { LiveScore } from './components/LiveScore'
import { MatchTimer } from './components/MatchTimer'
import { TeamDisplay } from './components/TeamDisplay'
import { TVDisplay } from './components/TVDisplay'
import { MatchNavigation } from './components/MatchNavigation'
import { useFullscreen } from './hooks/useFullscreen'

interface MonitorTabProps {
  tournament: Tournament
  schedule: Schedule
  onScoreUpdate: (matchId: string, homeScore: number, awayScore: number) => void
}

export const MonitorTab: React.FC<MonitorTabProps> = ({
  tournament,
  schedule,
  onScoreUpdate,
}) => {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [isTVMode, setIsTVMode] = useState(false)
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen()

  const currentMatch = schedule.matches[currentMatchIndex]

  const handleScoreChange = useCallback((team: 'home' | 'away', delta: number) => {
    const currentScore = team === 'home'
      ? currentMatch.homeScore ?? 0
      : currentMatch.awayScore ?? 0

    const newScore = Math.max(0, currentScore + delta)

    onScoreUpdate(
      currentMatch.id,
      team === 'home' ? newScore : currentMatch.homeScore ?? 0,
      team === 'away' ? newScore : currentMatch.awayScore ?? 0,
    )
  }, [currentMatch, onScoreUpdate])

  const handleNextMatch = useCallback(() => {
    if (currentMatchIndex < schedule.matches.length - 1) {
      setCurrentMatchIndex(prev => prev + 1)
    }
  }, [currentMatchIndex, schedule.matches.length])

  const handlePrevMatch = useCallback(() => {
    if (currentMatchIndex > 0) {
      setCurrentMatchIndex(prev => prev - 1)
    }
  }, [currentMatchIndex])

  // TV-Modus Rendering
  if (isTVMode) {
    return (
      <TVDisplay
        match={currentMatch}
        tournament={tournament}
        onExitTV={() => setIsTVMode(false)}
        onScoreChange={handleScoreChange}
      />
    )
  }

  // Normal-Modus Rendering
  return (
    <div className="monitor-tab">
      <header className="monitor-header">
        <h2>{tournament.name}</h2>
        <button onClick={() => setIsTVMode(true)}>TV-Modus</button>
      </header>

      <MatchNavigation
        currentIndex={currentMatchIndex}
        totalMatches={schedule.matches.length}
        onPrev={handlePrevMatch}
        onNext={handleNextMatch}
      />

      <div className="current-match">
        <TeamDisplay team={currentMatch.homeTeam} position="home" />

        <div className="match-center">
          <LiveScore
            match={currentMatch}
            onScoreChange={handleScoreChange}
            size="large"
          />
          <MatchTimer
            matchId={currentMatch.id}
            duration={tournament.settings.matchDuration * 60}
            onComplete={handleNextMatch}
          />
        </div>

        <TeamDisplay team={currentMatch.awayTeam} position="away" />
      </div>

      <footer className="monitor-footer">
        {/* Zusätzliche Controls */}
      </footer>
    </div>
  )
}
```

---

## Refactoring-Schritte

### Schritt 1: Tests schreiben (vor Refactoring!)

```typescript
// __tests__/MonitorTab.test.tsx
describe('MonitorTab', () => {
  it('displays current match', () => { ... })
  it('updates score when buttons clicked', () => { ... })
  it('navigates to next match', () => { ... })
  it('enters TV mode', () => { ... })
})
```

### Schritt 2: Hook extrahieren

1. Timer-Logik → `useMatchTimer.ts`
2. Fullscreen-Logik → `useFullscreen.ts`
3. Sound-Logik → `useSoundEffects.ts`

### Schritt 3: Komponenten extrahieren

1. Score-Anzeige → `LiveScore.tsx`
2. Timer-UI → `MatchTimer.tsx`
3. Team-Display → `TeamDisplay.tsx`
4. TV-Modus → `TVDisplay.tsx`

### Schritt 4: Container vereinfachen

1. Imports der neuen Komponenten
2. State-Management bleibt im Container
3. Callbacks an Kinder übergeben

---

## Definition of Done

- [ ] Tests für aktuelle Funktionalität geschrieben
- [ ] `useMatchTimer` Hook extrahiert und getestet
- [ ] `LiveScore` Komponente extrahiert (max. 100 Zeilen)
- [ ] `MatchTimer` Komponente extrahiert (max. 80 Zeilen)
- [ ] `TVDisplay` Komponente extrahiert (max. 150 Zeilen)
- [ ] `MonitorTab` Container auf max. 300 Zeilen reduziert
- [ ] Alle Tests bestehen (keine Regression)
- [ ] TypeScript ohne `any` Types
- [ ] Code-Review abgeschlossen

---

## Quellen

- [Common Sense Refactoring of a Messy React Component](https://alexkondov.com/refactoring-a-messy-react-component/)
- [Modularizing React Applications](https://martinfowler.com/articles/modularizing-react-apps.html)
- [React Design Patterns 2024](https://blog.bitsrc.io/top-5-react-design-patterns-that-you-should-know-in-2024-5f2696868222)
- [Advanced React Component Patterns](https://kentcdodds.com/blog/advanced-react-component-patterns)
