# Umsetzungsplan: Kritische Bugs

**Erstellt**: 2025-12-22
**Geschätzter Gesamtaufwand**: 4-5 Stunden
**Priorität**: KRITISCH

---

## Übersicht

| Bug-ID | Beschreibung | Aufwand | Risiko |
|--------|--------------|---------|--------|
| BUG-CRIT-001 | Race Condition bei schnellen Tor-Eingaben | 1h | Hoch |
| BUG-CRIT-002 | Undo-Logik bei RESULT_EDIT fehlerhaft | 1.5h | Mittel |
| BUG-CRIT-003 | localStorage Quota Überschreitung | 1.5h | Hoch |

---

## BUG-CRIT-001: Race Condition bei schnellen Tor-Eingaben

### Problem

Wenn zwei Tore sehr schnell hintereinander geklickt werden (< 100ms), kann das zweite Tor den falschen Basis-Score verwenden.

**Ursache**: `handleGoal` liest `match` aus dem Closure statt aus dem aktuellen State.

```typescript
// AKTUELL (fehlerhaft) - useLiveMatchManagement.ts:606-663
const handleGoal = useCallback((matchId: string, teamId: string, delta: 1 | -1) => {
  setLiveMatches(prev => {
    const match = prev.get(matchId);  // ✅ Richtig - aus prev lesen
    // ABER: onTournamentUpdate verwendet tournamentRef.current.matches
    // was beim schnellen Klicken veraltet sein kann
  });
}, [onTournamentUpdate]);
```

### Reproduktion

1. Spiel starten
2. Sehr schnell 2x auf "Tor [Team]" klicken (< 200ms)
3. Score ist manchmal 1 statt 2

### Lösung

**Datei**: `src/hooks/useLiveMatchManagement.ts`

**Änderung 1**: Tournament-Update asynchron nach State-Update

```typescript
// VORHER (Zeile 606-663):
const handleGoal = useCallback((matchId: string, teamId: string, delta: 1 | -1) => {
  setLiveMatches(prev => {
    const match = prev.get(matchId);
    if (!match) {
      console.error('handleGoal: Match not found:', matchId);
      return prev;
    }

    const isHomeTeam = match.homeTeam.id === teamId || match.homeTeam.name === teamId;
    const newHomeScore = isHomeTeam ? Math.max(0, match.homeScore + delta) : match.homeScore;
    const newAwayScore = !isHomeTeam ? Math.max(0, match.awayScore + delta) : match.awayScore;

    // ... event creation ...

    // PROBLEM: Dieses Update verwendet tournamentRef.current
    // was beim schnellen Klicken veraltet sein kann
    const updatedMatches = tournamentRef.current.matches.map(m => {
      if (m.id === matchId) {
        return { ...m, scoreA: newHomeScore, scoreB: newAwayScore };
      }
      return m;
    });
    onTournamentUpdate({ ...tournamentRef.current, matches: updatedMatches }, false);

    const updated = new Map(prev);
    updated.set(matchId, { ...match, homeScore: newHomeScore, awayScore: newAwayScore, events: [...match.events, event] });
    return updated;
  });
}, [onTournamentUpdate]);

// NACHHER:
const handleGoal = useCallback((matchId: string, teamId: string, delta: 1 | -1) => {
  // Verwende funktionales Update für beide State-Änderungen
  setLiveMatches(prev => {
    const match = prev.get(matchId);
    if (!match) {
      console.error('handleGoal: Match not found:', matchId);
      return prev;
    }

    const isHomeTeam = match.homeTeam.id === teamId || match.homeTeam.name === teamId;
    const newHomeScore = isHomeTeam ? Math.max(0, match.homeScore + delta) : match.homeScore;
    const newAwayScore = !isHomeTeam ? Math.max(0, match.awayScore + delta) : match.awayScore;

    const event: MatchEvent = {
      id: `${matchId}-${Date.now()}`,
      matchId,
      timestampSeconds: calculateRealTimeElapsed(match),
      type: 'GOAL',
      payload: {
        teamId: isHomeTeam ? match.homeTeam.id : match.awayTeam.id,
        teamName: isHomeTeam ? match.homeTeam.name : match.awayTeam.name,
        direction: delta > 0 ? 'INC' : 'DEC',
      },
      scoreAfter: {
        home: newHomeScore,
        away: newAwayScore,
      },
    };

    // Tournament-Update NACH dem setLiveMatches via setTimeout
    // damit der neue State garantiert verfügbar ist
    setTimeout(() => {
      const currentTournament = tournamentRef.current;
      const updatedMatches = currentTournament.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: newHomeScore,
            scoreB: newAwayScore,
          };
        }
        return m;
      });

      onTournamentUpdate({
        ...currentTournament,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      }, false);
    }, 0);

    const updated = new Map(prev);
    updated.set(matchId, {
      ...match,
      homeScore: newHomeScore,
      awayScore: newAwayScore,
      events: [...match.events, event],
    });
    return updated;
  });
}, [onTournamentUpdate]);
```

### Test-Szenario

```typescript
// Test: Schnelle Tor-Eingabe
it('should handle rapid goal clicks correctly', async () => {
  const { result } = renderHook(() => useLiveMatchManagement({ tournament, onTournamentUpdate }));

  // Start match
  act(() => {
    result.current.handleStart('match-1');
  });

  // Rapid clicks (simulate < 100ms apart)
  act(() => {
    result.current.handleGoal('match-1', 'team-home', 1);
    result.current.handleGoal('match-1', 'team-home', 1);
  });

  // Score should be 2, not 1
  expect(result.current.liveMatches.get('match-1')?.homeScore).toBe(2);
});
```

---

## BUG-CRIT-002: Undo-Logik bei RESULT_EDIT fehlerhaft

### Problem

Wenn ein `RESULT_EDIT` Event rückgängig gemacht wird, wird zum Score des vorherigen Events zurückgekehrt - auch wenn dieser Score vor dem manuellen Edit anders war.

**Beispiel**:
1. Spiel läuft, Score ist 3:2 (durch 5 GOAL-Events)
2. User korrigiert manuell auf 4:2 (RESULT_EDIT Event)
3. User klickt "Undo"
4. **Erwartet**: Score 3:2 (vor dem Edit)
5. **Tatsächlich**: Score 3:2 vom letzten GOAL-Event VOR dem Edit

Das Problem: Wenn keine Events vor dem RESULT_EDIT existieren, geht Score auf 0:0.

### Reproduktion

1. Spiel bei 0:0 starten
2. Manuell Ergebnis auf 3:2 setzen (RESULT_EDIT)
3. "Letztes Ereignis zurücknehmen" klicken
4. Score ist 0:0 statt dem erwarteten 0:0 (hier korrekt, aber:)
5. Wenn vorher Tore waren und dann RESULT_EDIT, geht der manuelle Edit verloren

### Lösung

**Datei**: `src/hooks/useLiveMatchManagement.ts`

**Änderung**: Undo-Logik verbessern

```typescript
// VORHER (Zeile 668-691):
const handleUndoLastEvent = useCallback((matchId: string) => {
  setLiveMatches(prev => {
    const match = prev.get(matchId);
    if (!match || match.events.length === 0) {
      console.error('handleUndoLastEvent: No events to undo');
      return prev;
    }

    const events = [...match.events];
    events.pop();

    const previousEvent = events[events.length - 1];
    const { home, away } = previousEvent.scoreAfter || { home: 0, away: 0 };

    const updated = new Map(prev);
    updated.set(matchId, {
      ...match,
      homeScore: home,
      awayScore: away,
      events,
    });
    return updated;
  });
}, []);

// NACHHER:
const handleUndoLastEvent = useCallback((matchId: string) => {
  setLiveMatches(prev => {
    const match = prev.get(matchId);
    if (!match || match.events.length === 0) {
      console.error('handleUndoLastEvent: No events to undo');
      return prev;
    }

    const events = [...match.events];
    const removedEvent = events.pop();

    // Bestimme den neuen Score basierend auf dem Event-Typ
    let newHomeScore: number;
    let newAwayScore: number;

    if (events.length === 0) {
      // Keine Events mehr -> Score auf 0:0 zurücksetzen
      newHomeScore = 0;
      newAwayScore = 0;
    } else {
      const previousEvent = events[events.length - 1];

      // Wenn das entfernte Event ein GOAL war, nehmen wir den Score vom vorherigen Event
      // Wenn es ein RESULT_EDIT war, müssen wir prüfen ob wir den vorherigen Score wiederherstellen
      if (removedEvent?.type === 'RESULT_EDIT') {
        // Bei RESULT_EDIT: Suche das letzte Event VOR dem Edit und nimm dessen Score
        // Das ist korrekt - wir wollen den Score VOR der manuellen Korrektur
        newHomeScore = previousEvent.scoreAfter?.home ?? 0;
        newAwayScore = previousEvent.scoreAfter?.away ?? 0;
      } else {
        // Bei GOAL oder STATUS_CHANGE: normales Verhalten
        newHomeScore = previousEvent.scoreAfter?.home ?? 0;
        newAwayScore = previousEvent.scoreAfter?.away ?? 0;
      }
    }

    // Auch Tournament-Matches aktualisieren
    setTimeout(() => {
      const currentTournament = tournamentRef.current;
      const updatedMatches = currentTournament.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: newHomeScore,
            scoreB: newAwayScore,
          };
        }
        return m;
      });

      onTournamentUpdate({
        ...currentTournament,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      }, false);
    }, 0);

    const updated = new Map(prev);
    updated.set(matchId, {
      ...match,
      homeScore: newHomeScore,
      awayScore: newAwayScore,
      events,
    });
    return updated;
  });
}, [onTournamentUpdate]);
```

### Zusätzliche Verbesserung: Undo nur für letzte 3 Sekunden

Um versehentliches Undo zu verhindern, könnte man ein Timeout einbauen:

```typescript
// Optional: Prüfe ob Event älter als 30 Sekunden ist
const handleUndoLastEvent = useCallback((matchId: string) => {
  setLiveMatches(prev => {
    const match = prev.get(matchId);
    if (!match || match.events.length === 0) {
      return prev;
    }

    const lastEvent = match.events[match.events.length - 1];
    const eventAge = Date.now() - parseInt(lastEvent.id.split('-').pop() || '0');

    // Warnung wenn Event älter als 30 Sekunden
    if (eventAge > 30000) {
      console.warn('Undo: Event is older than 30 seconds');
      // Optional: Hier könnte man einen Bestätigungsdialog triggern
    }

    // ... rest der Logik
  });
}, []);
```

### Test-Szenario

```typescript
it('should correctly undo RESULT_EDIT event', () => {
  const { result } = renderHook(() => useLiveMatchManagement({ tournament, onTournamentUpdate }));

  // Start und Tore erfassen
  act(() => {
    result.current.handleStart('match-1');
    result.current.handleGoal('match-1', 'team-home', 1); // 1:0
    result.current.handleGoal('match-1', 'team-home', 1); // 2:0
    result.current.handleGoal('match-1', 'team-away', 1); // 2:1
  });

  expect(result.current.liveMatches.get('match-1')?.homeScore).toBe(2);
  expect(result.current.liveMatches.get('match-1')?.awayScore).toBe(1);

  // Manuell korrigieren
  act(() => {
    result.current.handleManualEditResult('match-1', 5, 3);
  });

  expect(result.current.liveMatches.get('match-1')?.homeScore).toBe(5);

  // Undo sollte auf 2:1 zurückgehen (vor dem RESULT_EDIT)
  act(() => {
    result.current.handleUndoLastEvent('match-1');
  });

  expect(result.current.liveMatches.get('match-1')?.homeScore).toBe(2);
  expect(result.current.liveMatches.get('match-1')?.awayScore).toBe(1);
});
```

---

## BUG-CRIT-003: localStorage Quota Überschreitung

### Problem

Bei vielen Turnieren mit vielen Spielen kann das localStorage-Limit (~5MB) überschritten werden. Aktuell gibt es:
- Keine Größenprüfung
- Keine Fehlerbehandlung bei `QuotaExceededError`
- Keinen Cleanup alter Daten
- Keine Benutzer-Warnung

### Reproduktion

1. 50+ Turniere erstellen (oder Import von vielen Turnieren)
2. Jedes Turnier mit 20+ Spielen durchführen
3. localStorage-Limit erreicht
4. **Symptom**: Neue Änderungen werden nicht gespeichert, keine Fehlermeldung

### Lösung

**Mehrstufiger Ansatz**:

#### Schritt 1: Error Handling bei localStorage.setItem

**Datei**: `src/hooks/useLiveMatchManagement.ts`

```typescript
// VORHER (Zeile 121-124):
useEffect(() => {
  const obj = Object.fromEntries(liveMatches.entries());
  localStorage.setItem(storageKey, JSON.stringify(obj));
}, [liveMatches, storageKey]);

// NACHHER:
useEffect(() => {
  const obj = Object.fromEntries(liveMatches.entries());
  const data = JSON.stringify(obj);

  try {
    localStorage.setItem(storageKey, data);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[useLiveMatchManagement] localStorage quota exceeded!');

      // Versuche alte liveMatches anderer Turniere zu löschen
      const cleaned = cleanupOldLiveMatches(storageKey);

      if (cleaned) {
        // Retry nach Cleanup
        try {
          localStorage.setItem(storageKey, data);
          console.log('[useLiveMatchManagement] Successfully saved after cleanup');
        } catch {
          // Immer noch voll - Benutzer warnen
          dispatchStorageWarning();
        }
      } else {
        dispatchStorageWarning();
      }
    } else {
      console.error('[useLiveMatchManagement] localStorage error:', error);
    }
  }
}, [liveMatches, storageKey]);
```

#### Schritt 2: Cleanup-Funktion für alte Daten

**Neue Datei**: `src/utils/storageCleanup.ts`

```typescript
import { STORAGE_KEYS } from '../constants/storage';

/**
 * Gibt die geschätzte Größe des localStorage in Bytes zurück
 */
export function getLocalStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
    }
  }
  return total;
}

/**
 * Gibt die geschätzte freie Kapazität zurück (max 5MB)
 */
export function getLocalStorageFreeSpace(): number {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  return MAX_SIZE - getLocalStorageSize();
}

/**
 * Löscht alte liveMatches von anderen Turnieren
 * @param currentKey - Der Key des aktuellen Turniers (nicht löschen)
 * @returns true wenn etwas gelöscht wurde
 */
export function cleanupOldLiveMatches(currentKey: string): boolean {
  let cleaned = false;
  const liveMatchPrefix = 'liveMatches-';

  // Sammle alle liveMatches Keys
  const liveMatchKeys: { key: string; size: number; timestamp: number }[] = [];

  for (const key in localStorage) {
    if (key.startsWith(liveMatchPrefix) && key !== currentKey) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const entries = Object.values(parsed) as any[];

          // Finde den ältesten Timestamp in diesem Dataset
          let oldestTimestamp = Date.now();
          entries.forEach((match: any) => {
            if (match.timerStartTime) {
              const ts = new Date(match.timerStartTime).getTime();
              if (ts < oldestTimestamp) oldestTimestamp = ts;
            }
          });

          liveMatchKeys.push({
            key,
            size: data.length * 2,
            timestamp: oldestTimestamp,
          });
        }
      } catch {
        // Corrupt data - kann gelöscht werden
        localStorage.removeItem(key);
        cleaned = true;
      }
    }
  }

  // Sortiere nach Alter (älteste zuerst)
  liveMatchKeys.sort((a, b) => a.timestamp - b.timestamp);

  // Lösche älteste Einträge bis genug Platz frei ist (min 100KB)
  const targetFreeSpace = 100 * 1024; // 100KB

  for (const item of liveMatchKeys) {
    if (getLocalStorageFreeSpace() >= targetFreeSpace) {
      break;
    }

    console.log(`[storageCleanup] Removing old liveMatches: ${item.key}`);
    localStorage.removeItem(item.key);
    cleaned = true;
  }

  return cleaned;
}

/**
 * Prüft ob localStorage fast voll ist und gibt Warnung zurück
 */
export function checkStorageHealth(): {
  isHealthy: boolean;
  usedPercent: number;
  usedMB: number;
  message?: string;
} {
  const size = getLocalStorageSize();
  const maxSize = 5 * 1024 * 1024;
  const usedPercent = Math.round((size / maxSize) * 100);
  const usedMB = Math.round(size / 1024 / 1024 * 100) / 100;

  if (usedPercent >= 90) {
    return {
      isHealthy: false,
      usedPercent,
      usedMB,
      message: `Speicher fast voll (${usedPercent}%). Bitte alte Turniere löschen.`,
    };
  }

  if (usedPercent >= 70) {
    return {
      isHealthy: true,
      usedPercent,
      usedMB,
      message: `Speicher zu ${usedPercent}% belegt.`,
    };
  }

  return {
    isHealthy: true,
    usedPercent,
    usedMB,
  };
}
```

#### Schritt 3: Custom Event für UI-Warnung

**Datei**: `src/utils/storageCleanup.ts` (ergänzen)

```typescript
/**
 * Dispatcht ein Event für die UI, dass Speicher voll ist
 */
export function dispatchStorageWarning(): void {
  window.dispatchEvent(new CustomEvent('storage-quota-warning', {
    detail: {
      message: 'Der lokale Speicher ist voll. Änderungen können nicht gespeichert werden.',
      timestamp: Date.now(),
    },
  }));
}
```

#### Schritt 4: UI-Komponente für Warnung

**Datei**: `src/components/StorageWarningBanner.tsx` (neue Datei)

```typescript
import { useState, useEffect, CSSProperties } from 'react';
import { theme } from '../styles/theme';
import { checkStorageHealth } from '../utils/storageCleanup';

export const StorageWarningBanner: React.FC = () => {
  const [warning, setWarning] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Initial check
    const health = checkStorageHealth();
    if (!health.isHealthy) {
      setWarning(health.message || null);
    }

    // Listen for quota warnings
    const handleQuotaWarning = (event: CustomEvent) => {
      setWarning(event.detail.message);
      setIsDismissed(false);
    };

    window.addEventListener('storage-quota-warning', handleQuotaWarning as EventListener);

    return () => {
      window.removeEventListener('storage-quota-warning', handleQuotaWarning as EventListener);
    };
  }, []);

  if (!warning || isDismissed) {
    return null;
  }

  const bannerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
    background: theme.colors.error,
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 9999,
    fontSize: theme.fontSizes.sm,
  };

  return (
    <div style={bannerStyle}>
      <span>{warning}</span>
      <button
        onClick={() => setIsDismissed(true)}
        style={{
          background: 'transparent',
          border: '1px solid white',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Verstanden
      </button>
    </div>
  );
};
```

#### Schritt 5: Banner in App.tsx einbinden

**Datei**: `src/App.tsx`

```typescript
import { StorageWarningBanner } from './components/StorageWarningBanner';

function App() {
  return (
    <>
      <StorageWarningBanner />
      {/* ... rest of app */}
    </>
  );
}
```

### Test-Szenario

```typescript
describe('localStorage quota handling', () => {
  it('should handle QuotaExceededError gracefully', () => {
    // Mock localStorage to throw
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn().mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

    // Trigger save
    const { result } = renderHook(() => useLiveMatchManagement({ tournament, onTournamentUpdate }));

    act(() => {
      result.current.handleStart('match-1');
    });

    // Should dispatch warning event
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'storage-quota-warning',
      })
    );

    // Restore
    localStorage.setItem = originalSetItem;
  });

  it('should cleanup old liveMatches when quota exceeded', () => {
    // Setup: Add old tournament data
    localStorage.setItem('liveMatches-old-tournament-1', JSON.stringify({ match1: { timerStartTime: '2024-01-01T00:00:00Z' } }));
    localStorage.setItem('liveMatches-old-tournament-2', JSON.stringify({ match1: { timerStartTime: '2024-06-01T00:00:00Z' } }));

    const result = cleanupOldLiveMatches('liveMatches-current');

    expect(result).toBe(true);
    // Oldest should be removed first
    expect(localStorage.getItem('liveMatches-old-tournament-1')).toBeNull();
  });
});
```

---

## Implementierungs-Reihenfolge

### Tag 1: Vormittag (2h)

| Zeit | Task | Datei |
|------|------|-------|
| 0:00-0:30 | BUG-CRIT-001: Race Condition Fix | useLiveMatchManagement.ts |
| 0:30-1:00 | BUG-CRIT-001: Tests schreiben | useLiveMatchManagement.test.ts |
| 1:00-1:30 | BUG-CRIT-002: Undo-Logik Fix | useLiveMatchManagement.ts |
| 1:30-2:00 | BUG-CRIT-002: Tests schreiben | useLiveMatchManagement.test.ts |

### Tag 1: Nachmittag (2.5h)

| Zeit | Task | Datei |
|------|------|-------|
| 0:00-0:45 | storageCleanup.ts erstellen | src/utils/storageCleanup.ts |
| 0:45-1:15 | Error Handling in useLiveMatchManagement | useLiveMatchManagement.ts |
| 1:15-1:45 | StorageWarningBanner erstellen | src/components/StorageWarningBanner.tsx |
| 1:45-2:00 | In App.tsx einbinden | src/App.tsx |
| 2:00-2:30 | Tests & Manuelle Verifikation | storageCleanup.test.ts |

---

## Checkliste nach Implementierung

- [ ] BUG-CRIT-001: Schnelle Tor-Eingaben funktionieren korrekt
- [ ] BUG-CRIT-002: Undo bei RESULT_EDIT setzt korrekten Score
- [ ] BUG-CRIT-003: QuotaExceededError wird abgefangen
- [ ] BUG-CRIT-003: Alte liveMatches werden automatisch gelöscht
- [ ] BUG-CRIT-003: Benutzer sieht Warnung bei vollem Speicher
- [ ] Alle neuen Tests bestehen
- [ ] Keine Regression in bestehenden Tests
- [ ] Manueller Test auf echtem Gerät (Mobile)

---

## Rollback-Plan

Falls nach Deployment Probleme auftreten:

1. **BUG-CRIT-001**: setTimeout entfernen, zurück zur synchronen Variante
2. **BUG-CRIT-002**: Alte Undo-Logik wiederherstellen
3. **BUG-CRIT-003**: StorageWarningBanner auskommentieren, Error-Handling bleibt (schadet nicht)

Git-Tags für Rollback:
```bash
git tag -a pre-bugfix-crit-001 -m "Before race condition fix"
git tag -a pre-bugfix-crit-002 -m "Before undo logic fix"
git tag -a pre-bugfix-crit-003 -m "Before storage quota fix"
```
