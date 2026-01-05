# Match Cockpit Pro - Umsetzungsplan

**Datum:** 2026-01-05
**Basierend auf:** [MATCH-COCKPIT-PRO-REVIEW.md](./MATCH-COCKPIT-PRO-REVIEW.md)

---

## Priorisierung

| Priorität | Issue | Aufwand |
|-----------|-------|---------|
| P1 | Sound Loading-State exponieren | Klein |
| P1 | ARIA-Attribute für Toggle und Slider | Klein |
| P2 | Timer-Werte Validierung | Klein |
| P2 | Konsistente Error-Handling-Strategie | Mittel |
| P3 | Deprecated Felder Migration planen | Klein |
| P3 | Magic Numbers → Konstanten | Klein |
| P3 | Test-Coverage erhöhen | Groß |

---

## Detaillierte Umsetzungsschritte

### Phase 1: Kritische Fixes (P1)

#### 1.1 Sound Loading-State exponieren

**Datei:** `useMatchSound.ts`

**Änderungen:**
1. Neuen State `isLoading` hinzufügen
2. State in Return-Objekt exponieren
3. Loading-State während async Operationen setzen

**Code-Änderungen:**
```typescript
// Hinzufügen
const [isLoading, setIsLoading] = useState(false);

// In loadSound():
async function loadSound() {
  setIsLoading(true);  // NEU
  setIsReady(false);
  setError(null);
  // ... existing code ...
  setIsLoading(false);  // NEU am Ende
}

// Im Return:
return {
  // ... existing
  isLoading,  // NEU
};
```

**Betroffene Komponenten:**
- `useMatchCockpitPro.ts` - Return-Typ erweitern

#### 1.2 ARIA-Attribute für Toggle und Slider

**Datei:** `MatchCockpitSettingsPanel.tsx`

**Änderungen für Toggle:**
```typescript
function Toggle({ checked, onChange, disabled, label }: ToggleProps): JSX.Element {
  const id = useId();  // NEU
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}  // NEU
      onClick={() => !disabled && onChange(!checked)}
      // ...
    >
```

**Änderungen für Slider (Lautstärke):**
```typescript
<input
  type="range"
  min="0"
  max="100"
  value={settings.soundVolume}
  aria-label="Lautstärke"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={settings.soundVolume}
  // ...
/>
```

---

### Phase 2: Wichtige Verbesserungen (P2)

#### 2.1 Timer-Werte Validierung

**Datei:** `useMatchTimer.ts`

**Änderungen:**
```typescript
export function useMatchTimerExtended(
  timerStartTime: string | null | undefined,
  baseElapsedSeconds: number,
  status: MatchStatus,
  durationSeconds: number,
  direction: TimerDirection = 'countdown',
  nettoWarningSeconds: number = 120
): MatchTimerResult {
  // NEU: Validierung
  const safeDuration = Math.max(0, durationSeconds);
  const safeBase = Math.max(0, baseElapsedSeconds);
  const safeNettoWarning = Math.max(0, Math.min(nettoWarningSeconds, safeDuration));

  // Rest der Implementierung mit safe* Werten
}
```

#### 2.2 Konsistente Error-Handling-Strategie

**Strategie:**
1. Alle Fehler in State speichern (`error`)
2. console.error nur in Development
3. Error-Callbacks für kritische Fehler

**Änderungen in useMatchSound.ts:**
```typescript
const handleError = useCallback((message: string, err?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[useMatchSound] ${message}:`, err);
  }
  setError(message);
}, []);
```

---

### Phase 3: Nice-to-have (P3)

#### 3.1 Deprecated Felder Migration

**Plan:**
1. Migrate alle Nutzungen von `assistPlayerNumber` zu `assists`
2. Migrate `playerOutNumber`/`playerInNumber` zu `playersOut`/`playersIn`
3. Nach Migration: Deprecated Felder aus Interface entfernen

**Betroffene Dateien:**
- `MatchCockpit.tsx` (Interface-Definition)
- Event-Handler in aufrufenden Komponenten

#### 3.2 Magic Numbers → Konstanten

**Neue Datei:** `constants/matchCockpit.ts`

```typescript
export const MATCH_COCKPIT_CONSTANTS = {
  // Sound
  CUSTOM_SOUND_MAX_SIZE_KB: 500,
  CUSTOM_SOUND_MAX_SIZE_BYTES: 500 * 1024,

  // Toggle dimensions
  TOGGLE_WIDTH: 52,
  TOGGLE_HEIGHT: 28,
  TOGGLE_THUMB_SIZE: 24,

  // Timer defaults
  DEFAULT_NETTO_WARNING_SECONDS: 120,
  DEFAULT_AUTO_ADVANCE_SECONDS: 10,
} as const;
```

#### 3.3 Test-Coverage erhöhen

**Neue Test-Dateien:**
- `src/hooks/__tests__/useMatchSound.test.ts`
- `src/hooks/__tests__/useWakeLock.test.ts`
- `src/hooks/__tests__/useHapticFeedback.test.ts`
- `src/components/match-cockpit/__tests__/MatchCockpitSettingsPanel.test.tsx`

**Test-Strategien:**
1. **useMatchSound:** Mock Audio-Element, Test Loading/Playing States
2. **useWakeLock:** Mock navigator.wakeLock, Test acquire/release
3. **useHapticFeedback:** Mock navigator.vibrate, Test Pattern-Mapping
4. **MatchCockpitSettingsPanel:** RTL Tests für Interaktionen

---

## Geschätzter Aufwand

| Phase | Geschätzter Aufwand |
|-------|---------------------|
| Phase 1 | 1-2 Stunden |
| Phase 2 | 2-3 Stunden |
| Phase 3 | 4-6 Stunden |
| **Gesamt** | **7-11 Stunden** |

---

## Abhängigkeiten

- Keine externen Abhängigkeiten
- Phase 2 und 3 können parallel zu Phase 1 bearbeitet werden

---

## Risiken

1. **Audio API Mocking:** Tests für useMatchSound könnten komplex sein aufgrund der Audio-Element-API
2. **WakeLock API:** Nicht in allen Test-Environments verfügbar, muss gemockt werden

---

## Verifikation

Nach Umsetzung:
1. `npm run lint` - 0 Warnings
2. `npm run test` - Alle Tests bestehen
3. `npm run build` - Erfolgreich
4. Manuelle Tests im Browser (Sound, WakeLock, Timer)
