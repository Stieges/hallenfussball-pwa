# Match Cockpit Pro - Code Review

**Datum:** 2026-01-05
**Reviewer:** Claude Opus 4.5
**Komponenten:**
- [MatchCockpit.tsx](../../src/components/match-cockpit/MatchCockpit.tsx)
- [MatchCockpitSettingsPanel.tsx](../../src/components/match-cockpit/MatchCockpitSettingsPanel.tsx)
- [useMatchCockpitPro.ts](../../src/hooks/useMatchCockpitPro.ts)
- [useMatchSound.ts](../../src/hooks/useMatchSound.ts)
- [useWakeLock.ts](../../src/hooks/useWakeLock.ts)
- [useMatchTimer.ts](../../src/hooks/useMatchTimer.ts)

---

## Zusammenfassung

Das Match Cockpit Pro Feature ist gut strukturiert mit klarer Trennung zwischen Präsentation (MatchCockpit.tsx) und Logik (Hooks). Die kürzlich behobenen Memory-Leak-Issues (Sound-Handler, WakeLock-Listener) haben die Qualität verbessert.

---

## Findings

### Kritische Issues

#### 1. Race Condition bei Sound-Laden (useMatchSound.ts:150)
**Schweregrad:** Mittel
**Beschreibung:** Die `loadSound` Funktion setzt `isReady` erst nach async Operationen. Wenn der User währenddessen versucht, den Sound abzuspielen, wird nichts passieren.
**Betroffener Code:**
```typescript
void loadSound();
// User könnte versuchen play() aufzurufen bevor loadSound() fertig ist
```
**Empfehlung:** Loading-State exponieren und UI entsprechend anpassen.

#### 2. Fehlende Validierung bei Timer-Werten (useMatchTimer.ts:157)
**Schweregrad:** Niedrig
**Beschreibung:** `durationSeconds` und `nettoWarningSeconds` werden nicht validiert. Negative Werte oder NaN könnten zu unerwartetem Verhalten führen.
**Empfehlung:** Validierung am Hook-Eingang hinzufügen.

---

### Warnungen

#### 3. Deprecated API Usage (MatchCockpit.tsx:53-66)
**Beschreibung:** Mehrere deprecated Felder in `MatchEvent.payload`:
- `assistPlayerNumber` (deprecated, use `assists`)
- `playerOutNumber` / `playerInNumber` (deprecated, use `playersOut` / `playersIn`)
**Empfehlung:** Migration auf neue Felder planen und alte Felder entfernen.

#### 4. Nicht verwendete isTablet Variable (MatchCockpit.tsx - nicht direkt sichtbar)
**Beschreibung:** In TournamentAdminCenter wird `isTablet` destrukturiert aber mit `_isTablet` unterdrückt.
**Empfehlung:** Entfernen wenn nicht benötigt.

#### 5. Inkonsistente Error-Handling-Strategie (useMatchSound.ts)
**Beschreibung:** Fehler werden teils geloggt, teils in State gespeichert, teils ignoriert.
```typescript
} catch (err) {
  console.error('[useMatchSound] Failed to load sound:', err);
  if (isMounted) {
    setError('Sound konnte nicht geladen werden');
  }
}
```
**Empfehlung:** Konsistente Error-Handling-Strategie etablieren.

#### 6. Magic Numbers (MatchCockpitSettingsPanel.tsx)
**Beschreibung:** Hardcodierte Werte ohne Konstanten:
- Dateigrößenlimit 500KB (nicht im Code verifiziert, nur in UI-Text)
- Toggle-Dimensionen (52px, 28px, 24px)
**Empfehlung:** Zentrale Konstanten definieren.

---

### Verbesserungsvorschläge

#### 7. Accessibility Verbesserungen

**7a. Toggle-Komponente fehlt Label**
```typescript
<button
  type="button"
  role="switch"
  aria-checked={checked}
  // Fehlt: aria-label oder aria-labelledby
>
```

**7b. Slider fehlt ARIA-Attribute**
```typescript
<input
  type="range"
  // Fehlt: aria-label, aria-valuemin, aria-valuemax, aria-valuenow
>
```

#### 8. Performance-Optimierung möglich

**8a. Styles-Objekt wird bei jedem Render neu erstellt**
```typescript
const styles: Record<string, CSSProperties> = { ... };
```
**Empfehlung:** Außerhalb der Komponente definieren oder useMemo verwenden.

**8b. useMatchTimer könnte von useMemo profitieren**
Der Result-Objekt in `useMatchTimerExtended` nutzt bereits `useMemo`, was gut ist.

#### 9. Test-Coverage

**Fehlende Tests:**
- useMatchSound.ts hat keine Unit-Tests
- useWakeLock.ts hat keine Unit-Tests
- useHapticFeedback.ts hat keine Unit-Tests
- MatchCockpitSettingsPanel.tsx hat keine Unit-Tests

---

## Code-Qualität Metriken

| Kategorie | Bewertung | Notizen |
|-----------|-----------|---------|
| Lesbarkeit | Gut | Klare Struktur, gute Kommentare |
| Wartbarkeit | Gut | Modulare Hooks, klare Verantwortlichkeiten |
| Performance | Gut | requestAnimationFrame optimiert, useRef statt useState |
| Accessibility | Verbesserungsbedürftig | Fehlende ARIA-Attribute |
| Test-Coverage | Mangelhaft | Nur useMatchTimer.ts hat Tests |
| Security | Gut | Keine offensichtlichen Schwachstellen |

---

## Risiken

1. **Audio-Autoplay-Restrictions:** Browser-Policies können Sound-Wiedergabe blockieren. Die `activate`-Funktion adressiert dies, aber UX könnte verbessert werden.

2. **WakeLock-API Support:** Nicht alle Browser unterstützen die Wake Lock API. Fallback fehlt (nur Error-Message).

3. **IndexedDB für Custom Sounds:** Abhängigkeit von Browser-Speicher. Kein Fallback bei vollem Speicher.

---

## Nächste Schritte

Siehe [MATCH-COCKPIT-PRO-IMPLEMENTATION-PLAN.md](./MATCH-COCKPIT-PRO-IMPLEMENTATION-PLAN.md) für den Umsetzungsplan.
