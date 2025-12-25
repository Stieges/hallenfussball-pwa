# US-MONITOR-OPTIMIZATION: Allgemeine Monitor-Optimierungen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MONITOR-OPTIMIZATION |
| **Priorität** | Medium |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Monitor |
| **Impact** | Mittel |

---

## User Story

**Als** Turnierleiter mit einem TV/Beamer in der Halle
**möchte ich** dass die Monitor-Ansicht optimal für Großbildschirme optimiert ist
**damit** alle Zuschauer den Spielverlauf klar und ohne Probleme verfolgen können

---

## Kontext

Die bestehenden Monitor-Stories (MON-TV-01 bis 04) definieren die Kernfunktionen. Diese Story ergänzt:
- Performance-Optimierungen
- Layout-Anpassungen für verschiedene Bildschirmgrößen
- Konfigurationsoptionen
- Burn-In-Schutz

---

## Acceptance Criteria

### AC1-4: Automatische Aktualisierung & Performance

1. Given die Monitor-Ansicht ist geöffnet, Then aktualisiert sich der Spielstand automatisch ohne Neuladen (bereits in MON-TV-01, hier bestätigt).

2. Given die Monitor-Ansicht läuft über mehrere Stunden, Then darf es keine Memory-Leaks oder Performance-Degradation geben.

3. Given die Internetverbindung bricht kurz ab, Then zeigt die Monitor-Ansicht den letzten bekannten Stand an (kein Crash).

4. Given die Verbindung ist wiederhergestellt, Then synchronisiert sich die Ansicht automatisch.

### AC5-8: Layout & Darstellung

5. Given die Monitor-Ansicht wird im Vollbild-Modus geöffnet, Then gibt es keine Browser-UI (Adressleiste, Tabs) sichtbar.

6. Given der Bildschirm ist 16:9 (Standard-TV), Then nutzt das Layout die volle Breite optimal aus.

7. Given der Bildschirm ist 4:3 oder anders proportioniert, Then skaliert das Layout entsprechend ohne abgeschnittene Inhalte.

8. Given der Bildschirm hat geringe Auflösung (720p), Then sind alle Texte weiterhin lesbar (Mindestgröße).

### AC9-12: Konfiguration

9. Given ich öffne die Monitor-Einstellungen, Then kann ich auswählen:
   - Theme (Hell/Dunkel)
   - Schriftgröße (Normal/Groß/Sehr groß)
   - Timer-Anzeige (Hochzählen/Runterzählen)
   - Tor-Animation (An/Aus)

10. Given ich wähle "Dunkles Theme", Then werden alle Farben invertiert für bessere Lesbarkeit bei hellem Umgebungslicht.

11. Given ich wähle "Timer runterzählen", Then zeigt der Timer die verbleibende Zeit statt der vergangenen Zeit.

12. Given meine Einstellungen sind gespeichert, Then werden sie beim nächsten Öffnen automatisch geladen.

### AC13-15: Burn-In-Schutz (OLED/Plasma)

13. Given die Monitor-Ansicht läuft auf einem OLED-TV, Then ist ein dezenter Burn-In-Schutz aktiviert (z.B. minimale Position-Shifts).

14. Given kein Spiel läuft (Pause), Then zeigt die Ansicht einen Bildschirmschoner oder wechselnde Informationen.

15. Given ich möchte den Burn-In-Schutz deaktivieren (LED-TV), Then gibt es eine Option dafür.

### AC16-18: Multi-Feld-Unterstützung

16. Given das Turnier hat 2+ Felder, Then kann ich wählen welches Feld die Monitor-Ansicht zeigt.

17. Given ich wähle "Alle Felder", Then werden alle laufenden Spiele in einer Grid-Ansicht dargestellt.

18. Given nur ein Spiel läuft, Then zeigt die Monitor-Ansicht automatisch dieses Spiel im Vollformat.

---

## UI-Konzept

### Monitor-Einstellungen (über URL-Parameter oder Menü)

```
┌─────────────────────────────────────────────────────────────┐
│                   Monitor-Einstellungen                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Theme:                                                     │
│  ○ Hell (Standard)   ● Dunkel                              │
│                                                             │
│  Schriftgröße:                                              │
│  ○ Normal   ● Groß   ○ Sehr groß                           │
│                                                             │
│  Timer-Anzeige:                                             │
│  ● Hochzählen (0:00 → 12:00)                               │
│  ○ Runterzählen (12:00 → 0:00)                             │
│                                                             │
│  Tor-Animation:                                             │
│  [Toggle: An] ●                                             │
│                                                             │
│  Burn-In-Schutz:                                            │
│  [Toggle: An] ●                                             │
│                                                             │
│  Feld-Auswahl:                                              │
│  [Feld 1 ▼]   [ ] Alle Felder                              │
│                                                             │
│                  [Schließen]   [Übernehmen]                 │
└─────────────────────────────────────────────────────────────┘
```

### URL-Parameter Alternative

```
/tournament/{id}/monitor?
  field=1
  &theme=dark
  &size=large
  &countdown=true
  &burn-in-protection=false
```

### Grid-Ansicht (2+ Felder)

```
┌───────────────────────────────────────────────────────────────┐
│                      Hallenturnier 2025                       │
├─────────────────────────────┬─────────────────────────────────┤
│         FELD 1              │           FELD 2                │
│  FC Bayern vs TSV 1860      │   SpVgg vs VfB                  │
│                             │                                 │
│         2 : 1               │         0 : 0                   │
│                             │                                 │
│        08:34                │        03:22                    │
│  ████████░░░░               │  ███░░░░░░░░░                   │
└─────────────────────────────┴─────────────────────────────────┘
```

---

## Technisches Konzept

### Performance-Optimierungen

```typescript
// Verhindern von Memory-Leaks bei langer Laufzeit
useEffect(() => {
  // Regelmäßiges Cleanup alter Animation-Frames
  const cleanupInterval = setInterval(() => {
    // Clear alte Goal-Animation Timeouts
    goalTimeouts.current.forEach(clearTimeout);
    goalTimeouts.current = [];
  }, 60000); // Jede Minute

  return () => clearInterval(cleanupInterval);
}, []);

// Lazy Updates nur wenn Werte sich ändern
const MemoizedScoreboard = React.memo(Scoreboard, (prev, next) => {
  return prev.homeScore === next.homeScore &&
         prev.awayScore === next.awayScore &&
         prev.elapsedTime === next.elapsedTime;
});
```

### Burn-In-Schutz

```typescript
// Minimale zufällige Verschiebung alle 60 Sekunden
const useBurnInProtection = (enabled: boolean) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setOffset({
        x: Math.random() * 4 - 2, // -2 bis +2 Pixel
        y: Math.random() * 4 - 2,
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [enabled]);

  return offset;
};
```

### Offline-Handling

```typescript
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastData, setLastData] = useState<MatchData | null>(null);

  // Bei Offline: Letzten Stand behalten
  const data = isOnline ? liveData : lastData;

  // Banner anzeigen wenn offline
  return { data, isOnline };
};
```

---

## Phasen

### Phase 1: Performance & Stabilität
- [ ] Memory-Leak-Prevention
- [ ] Offline-Handling
- [ ] Fullscreen-API Integration

### Phase 2: Konfiguration
- [ ] Settings-Dialog
- [ ] URL-Parameter Support
- [ ] localStorage Persistenz

### Phase 3: Erweiterte Features
- [ ] Burn-In-Schutz
- [ ] Multi-Feld Grid
- [ ] Countdown-Timer Option

---

## Aufwand

| Phase | Geschätzter Aufwand |
|-------|---------------------|
| Phase 1 | 2-3 Stunden |
| Phase 2 | 2 Stunden |
| Phase 3 | 2-3 Stunden |

---

## Bestehende Monitor-Stories

| ID | Beschreibung | Status |
|----|--------------|--------|
| MON-TV-01 | Paarung + Spielstand | Open |
| MON-TV-02 | Spielzeit + Restzeit | Open |
| MON-TV-03 | Tor-Animation | Open |
| MON-TV-04 | Vorschau nächste Paarung | Open |
| MON-TV-GOAL-SFX-01 | Team-spezifische Sounds | Open |
| MON-LIVE-INDICATOR-01 | Live-Markierung | Open |

---

## Verwandte User Stories

- **MON-TV-01 bis 04:** Basis Monitor-Funktionen
- **US-PWA-OFFLINE:** Offline-Fähigkeit
- **US-TEAM-LOGOS:** Logos im Monitor
