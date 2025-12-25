# US-MATCH-DISPLAY-UX: Modernes Match-Karten-Layout

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MATCH-DISPLAY-UX |
| **Priorität** | High |
| **Status** | Draft |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | UI/UX |
| **Impact** | Sehr Hoch - Kernfunktion der App, direkte Auswirkung auf Nutzererlebnis |

---

## User Story

**Als** Turnierleiter, Trainer oder Zuschauer
**möchte ich** Spielpaarungen und Ergebnisse auf einen Blick erfassen können,
**damit** ich schnell den aktuellen Stand des Turniers verstehe, ohne lange suchen zu müssen.

---

## Wissenschaftliche Grundlage

### Eye-Tracking Forschung

Laut [Ramotion Visual Hierarchy Research](https://www.ramotion.com/blog/visual-hierarchy/):
- Nutzer scannen Sport-Inhalte im **Z-Pattern**: Logo → Score → nächstes Match
- Das menschliche Gehirn verarbeitet visuelle Information schneller als Text
- Kontraste und Größenunterschiede lenken die Aufmerksamkeit

### Karten vs. Tabellen Usability

Laut [Smashing Magazine](https://www.smashingmagazine.com/2016/10/designing-card-based-user-interfaces/) und [UX-Studien](https://medium.com/design-bootcamp/when-to-use-which-component-a-case-study-of-card-view-vs-table-view-7f5a6cff557b):

| Metrik | Karten-UI | Tabellen-UI |
|--------|-----------|-------------|
| User Interaction | **+60%** | Baseline |
| User Retention | **+30%** | Baseline |
| Conversion Rate | **+30%** | Baseline |
| Mobile UX | Exzellent | Problematisch |

> "Cards are better for browsing than for searching. Images and other 'tall' elements call for a card layout."

### Scoreboard-Design Psychologie

Laut [ScoreVision Research](https://blog.scorevision.com/led-video-scoreboard-design-best-practices):

> "Fans may only look up at the video scoreboard for a few seconds. Keep it short: **max 10 words, max 3 visual elements**."

### WCAG Accessibility

- Mindestkontrast für Text: **4.5:1** (AA-Standard)
- Hoher Kontrast (z.B. Rot auf Hell) erzeugt sofortige Aufmerksamkeit
- [CDC-Forschung](https://www.cdc.gov/) bestätigt: Starker Kontrast verbessert Lesbarkeit und Fokus

---

## Kontext

### Aktueller Stand (Ist-Analyse)

| Aspekt | Aktuell | Problem |
|--------|---------|---------|
| **Layout** | Tabellen-basiert | Horizontal scrollen auf Mobile |
| **Farbschema** | Dunkles Theme (#0a0a0a) | Schlechte Lesbarkeit bei Tageslicht |
| **Score-Größe** | ~18px (text-lg) | Nicht prominent genug |
| **Live-Indicator** | Statisch, klein | Nicht auffällig |
| **Team-Logos** | Keine | Fehlende visuelle Ankerpunkte |
| **Status-Unterscheidung** | Minimal | Live/Beendet/Anstehend nicht erkennbar |

### Industrie-Benchmark

| App | Layout | Theme | Score-Größe | Live-Indicator |
|-----|--------|-------|-------------|----------------|
| **ESPN** | Karten | Hell (Default) | 32px+ | Rot, pulsierend |
| **Sofascore** | Karten | Hell/Dunkel | 28px+ | Rot, animiert |
| **Flashscore** | Karten | Hell (Default) | 24px+ | Grün, blinkend |
| **FIFA App** | Karten | Hell | 32px+ | Rot Badge |
| **Hallenfussball** | Tabellen | Dunkel | 18px | Statisch |

---

## Akzeptanzkriterien

### AC-1: Karten-basiertes Layout

- [ ] Jedes Spiel wird als eigenständige **Karte** dargestellt
- [ ] Vertikales Scrollen statt horizontalem
- [ ] Responsive: 1 Spalte (Mobile), 2-3 Spalten (Desktop)
- [ ] Mindestens 48x48px Touch-Target für interaktive Elemente

### AC-2: Visuelle Hierarchie (Score-First)

- [ ] **Score**: 32-40px, Extra Bold, zentral/rechts
- [ ] **Teams**: 18px, Medium Weight, mit Logo-Platzhalter
- [ ] **Zeit/Status**: 14px, Grau, sekundär
- [ ] **Aktionen**: Icons, tertiär
- [ ] Gewinner-Team optisch hervorgehoben (Bold + Farbe)

### AC-3: Status-Indikatoren

- [ ] **LIVE**: Roter Balken links + pulsierende Animation + "LIVE" Badge
- [ ] **Beendet**: Grauer Balken + "FT" Badge + reduzierte Opacity
- [ ] **Anstehend**: Blauer Balken + Uhrzeit prominent
- [ ] Status auf ersten Blick erkennbar (< 1 Sekunde)

### AC-4: Helles Theme als Default

- [ ] Light Mode als Standard (bessere Lesbarkeit bei Tageslicht)
- [ ] Dark Mode als Option (Toggle in Settings)
- [ ] WCAG AA Kontrast (min. 4.5:1) für alle Text-Elemente
- [ ] Konsistente Anwendung über alle Screens

### AC-5: Team-Identität

- [ ] Platzhalter für Team-Logos (Initialen-Badge)
- [ ] Farbiger Badge basierend auf Team-Hash
- [ ] Platz für echte Logos (wenn US-TEAM-LOGOS implementiert)

### AC-6: Mobile-First Design

- [ ] Touch-optimierte Abstände (min. 8px zwischen Elementen)
- [ ] Swipe-Gesten für schnelle Navigation
- [ ] Keine horizontalen Scroll-Container
- [ ] Ladezeit < 3 Sekunden für 50+ Matches

### AC-7: Animations & Feedback

- [ ] Live-Pulse Animation (2s ease-in-out infinite)
- [ ] Hover-State mit Shadow-Erhöhung
- [ ] Tap-Feedback (Scale 0.98)
- [ ] Smooth Transitions (200ms)

---

## UI-Konzept

### Match-Karte (Light Theme)

```
┌─────────────────────────────────────────────────────────────┐
│▌                                                            │
│▌  09:15  •  Feld 1                          🔴 LIVE        │
│▌                                                            │
│▌  ┌────┐                                                   │
│▌  │ FC │  FC Musterstadt                              3    │
│▌  └────┘                                                   │
│▌                                                            │
│▌  ┌────┐                                                   │
│▌  │ SV │  SV Beispieldorf                             1    │
│▌  └────┘                                                   │
│▌                                                            │
└─────────────────────────────────────────────────────────────┘
  ↑ Roter Balken = LIVE
```

### Match-Karte (Beendet)

```
┌─────────────────────────────────────────────────────────────┐
│▌                                                            │
│▌  09:00  •  Feld 2                             FT          │
│▌                                                            │
│▌  ┌────┐                                                   │
│▌  │ TS │  TSV Testheim                    (Bold)  2        │
│▌  └────┘                                                   │
│▌                                                            │
│▌  ┌────┐                                                   │
│▌  │ VF │  VfB Demo                        (Grau)  0        │
│▌  └────┘                                                   │
│▌                                                            │
└─────────────────────────────────────────────────────────────┘
  ↑ Grauer Balken = Beendet
```

### Spielplan-Übersicht (Grid)

```
┌─────────────────────────────────────────────────────────────┐
│ Gruppe A                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 09:00  Feld 1   │  │ 09:00  Feld 2   │                  │
│  │                 │  │                 │                  │
│  │ FC Muster   2   │  │ TSV Test    1   │                  │
│  │ SV Beisp.  1   │  │ VfB Demo    1   │                  │
│  │            FT   │  │            FT   │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 09:15  Feld 1   │  │ 09:15  Feld 2   │                  │
│  │        🔴 LIVE  │  │                 │                  │
│  │ FC Muster   3   │  │ TSV Test    -   │                  │
│  │ VfB Demo    1   │  │ SV Beisp.   -   │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Theme-Vergleich

```
┌─ LIGHT THEME (Default) ─────────┐  ┌─ DARK THEME (Option) ──────────┐
│                                 │  │                                 │
│  Background: #f8f9fa            │  │  Background: #0a0a0a            │
│  Card:       #ffffff            │  │  Card:       #1a1a1a            │
│  Text:       #1a1a1a            │  │  Text:       #ffffff            │
│  Score:      #000000 (bold)     │  │  Score:      #ffffff (bold)     │
│  Muted:      #6c757d            │  │  Muted:      #888888            │
│  Live:       #dc3545            │  │  Live:       #ff4444            │
│  Border:     #dee2e6            │  │  Border:     #333333            │
│                                 │  │                                 │
│  ☀️ Bessere Lesbarkeit          │  │  🌙 Augenschonend bei Nacht     │
│     bei Tageslicht              │  │     OLED-Akku-Sparend           │
│                                 │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

---

## Technisches Konzept

### Neue Komponenten

```
src/components/match/
├── MatchCard.tsx              # Einzelne Match-Karte
├── MatchCardCompact.tsx       # Kompakte Variante
├── MatchCardSkeleton.tsx      # Loading-State
├── MatchStatusBadge.tsx       # LIVE/FT/Scheduled Badge
├── MatchScoreDisplay.tsx      # Score mit Gewinner-Highlight
├── TeamRow.tsx                # Team mit Logo + Name + Score
└── index.ts

src/components/schedule/
├── MatchGrid.tsx              # Responsive Grid-Container
├── GroupedMatchList.tsx       # Nach Gruppen sortiert
└── ScheduleViewToggle.tsx     # Karten/Kompakt Switch
```

### MatchCard Komponente

```typescript
// src/components/match/MatchCard.tsx

interface MatchCardProps {
  match: ScheduleMatch;
  tournament?: Tournament;
  variant?: 'default' | 'compact' | 'live';
  onEdit?: (matchId: string) => void;
  showActions?: boolean;
}

export function MatchCard({
  match,
  tournament,
  variant = 'default',
  onEdit,
  showActions = false,
}: MatchCardProps) {
  const isLive = match.status === 'running';
  const isFinished = match.scoreA !== undefined && match.scoreB !== undefined;
  const homeWins = (match.scoreA ?? 0) > (match.scoreB ?? 0);
  const awayWins = (match.scoreB ?? 0) > (match.scoreA ?? 0);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-card border transition-all',
        'hover:shadow-lg hover:border-primary/20',
        isLive && 'ring-2 ring-red-500 animate-pulse-border',
        isFinished && 'opacity-90'
      )}
    >
      {/* Status Bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          isLive && 'bg-red-500',
          isFinished && 'bg-gray-400',
          !isLive && !isFinished && 'bg-blue-500'
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{match.time}</span>
          <span>•</span>
          <span>Feld {match.field}</span>
        </div>
        <MatchStatusBadge status={isLive ? 'live' : isFinished ? 'finished' : 'scheduled'} />
      </div>

      {/* Teams & Scores */}
      <div className="px-4 pb-4 space-y-2">
        <TeamRow
          team={match.homeTeam}
          score={match.scoreA}
          isWinner={homeWins}
          tournament={tournament}
        />
        <TeamRow
          team={match.awayTeam}
          score={match.scoreB}
          isWinner={awayWins}
          tournament={tournament}
        />
      </div>

      {/* Actions */}
      {showActions && onEdit && (
        <div className="px-4 pb-3 pt-2 border-t">
          <button
            onClick={() => onEdit(match.id)}
            className="text-sm text-primary hover:underline"
          >
            Bearbeiten
          </button>
        </div>
      )}
    </div>
  );
}
```

### Theme System

```typescript
// src/styles/themes.ts

export const lightTheme = {
  name: 'light',
  colors: {
    background: '#f8f9fa',
    card: '#ffffff',
    cardHover: '#f1f3f5',
    foreground: '#1a1a1a',
    muted: '#6c757d',
    border: '#dee2e6',

    // Status
    live: '#dc3545',
    liveBackground: 'rgba(220, 53, 69, 0.1)',
    finished: '#6c757d',
    scheduled: '#0d6efd',

    // Scores
    scoreWinner: '#000000',
    scoreDefault: '#495057',
  },
};

export const darkTheme = {
  name: 'dark',
  colors: {
    background: '#0a0a0a',
    card: '#1a1a1a',
    cardHover: '#252525',
    foreground: '#ffffff',
    muted: '#888888',
    border: '#333333',

    // Status
    live: '#ff4444',
    liveBackground: 'rgba(255, 68, 68, 0.15)',
    finished: '#888888',
    scheduled: '#4488ff',

    // Scores
    scoreWinner: '#ffffff',
    scoreDefault: '#aaaaaa',
  },
};
```

### CSS Animations

```css
/* src/styles/animations.css */

@keyframes pulse-border {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 53, 69, 0);
  }
}

.animate-pulse-border {
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes live-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.animate-live-dot {
  animation: live-dot 1.5s ease-in-out infinite;
}
```

---

## Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/match/MatchCard.tsx` | NEU: Haupt-Match-Karte |
| `src/components/match/TeamRow.tsx` | NEU: Team-Zeile mit Logo |
| `src/components/match/MatchStatusBadge.tsx` | NEU: Status-Badge |
| `src/components/schedule/MatchGrid.tsx` | NEU: Responsive Grid |
| `src/components/schedule/GroupStageSchedule.tsx` | Refactor auf MatchGrid |
| `src/components/schedule/FinalStageSchedule.tsx` | Refactor auf MatchGrid |
| `src/styles/themes.ts` | Light + Dark Theme |
| `src/styles/animations.css` | NEU: Live-Animationen |
| `src/hooks/useTheme.ts` | NEU: Theme-Hook |
| `src/contexts/ThemeContext.tsx` | NEU: Theme-Context |
| `src/App.tsx` | ThemeProvider integrieren |

---

## Implementierungsphasen

### Phase 1: Foundation (3-4h)
- [ ] Theme-System (Light/Dark) implementieren
- [ ] CSS-Variablen für Farben
- [ ] useTheme Hook
- [ ] ThemeProvider

### Phase 2: Match-Komponenten (4-5h)
- [ ] MatchCard Komponente
- [ ] TeamRow mit Logo-Platzhalter
- [ ] MatchStatusBadge
- [ ] MatchScoreDisplay
- [ ] Responsive Grid

### Phase 3: Integration (3-4h)
- [ ] GroupStageSchedule auf MatchGrid umstellen
- [ ] FinalStageSchedule auf MatchGrid umstellen
- [ ] Live-Ansicht anpassen
- [ ] Animationen implementieren

### Phase 4: Polish (2h)
- [ ] Hover/Touch States
- [ ] Loading Skeletons
- [ ] Accessibility (ARIA, Focus)
- [ ] Performance-Optimierung

### Phase 5: Theme Toggle (1h)
- [ ] Settings-Integration
- [ ] Persistierung (localStorage)
- [ ] System-Preference Detection

---

## Erwartete Verbesserungen

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|--------------|
| **User Interaction** | Baseline | +60% | Karten-Layout |
| **Scanbarkeit** | 3-5s | <1s | Visuelle Hierarchie |
| **Mobile UX** | Problematisch | Exzellent | Touch-optimiert |
| **Live-Erkennbarkeit** | Gering | Sofort | Animation + Farbe |
| **Lesbarkeit (Tageslicht)** | Schlecht | Sehr gut | Light Theme |
| **WCAG Compliance** | Teilweise | AA | Kontrast-Optimierung |

---

## Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Breaking Changes | Hoch | Schrittweise Migration |
| Performance (viele Karten) | Mittel | Virtualisierung ab 100+ |
| User-Gewöhnung | Niedrig | Alte Ansicht als Option |
| Theme-Inkonsistenz | Mittel | Design-System durchsetzen |

---

## Abgrenzung

**In Scope:**
- Karten-Layout für Matches
- Light/Dark Theme
- Visuelle Hierarchie (Score-First)
- Status-Indikatoren (Live/FT/Scheduled)
- Team-Logo-Platzhalter
- Mobile-First Design

**Out of Scope:**
- Echte Team-Logos (→ US-TEAM-LOGOS)
- Corporate Colors (→ US-CORPORATE-COLORS)
- PDF-Layout-Änderungen (→ US-PDF-FORMATS)
- Offline-Modus Verbesserungen
- Push-Notifications

---

## Quellen & Referenzen

### Wissenschaftliche Grundlagen
- [Ramotion: Visual Hierarchy Principles](https://www.ramotion.com/blog/visual-hierarchy/)
- [The Decision Lab: Visual Hierarchy Psychology](https://thedecisionlab.com/reference-guide/design/visual-hierarchy)
- [Wiley: State of the Art of Sports Data Visualization](https://onlinelibrary.wiley.com/doi/10.1111/cgf.13447)

### UX Best Practices
- [Smashing Magazine: Card-Based User Interfaces](https://www.smashingmagazine.com/2016/10/designing-card-based-user-interfaces/)
- [Medium: Cards vs Tables Case Study](https://medium.com/design-bootcamp/when-to-use-which-component-a-case-study-of-card-view-vs-table-view-7f5a6cff557b)
- [ScoreVision: LED Scoreboard Design](https://blog.scorevision.com/led-video-scoreboard-design-best-practices)

### Sport-App Design
- [Design4Users: Sports App UI](https://design4users.com/design-for-sport-creating-user-interfaces-for-fitness-apps/)
- [Locker Room Labs: Sports Tech UX/UI](https://www.lockerroomlabs.com/revolutionizing-sports-technology-through-ux-ui-design/)

---

## Verwandte User Stories

- **US-TEAM-LOGOS**: Echte Logos statt Platzhalter
- **US-CORPORATE-COLORS**: Individuelle Farbschemata
- **US-LOGO-INTEGRATION**: Event/Sponsor-Logos
- **US-PDF-FORMATS**: Konsistente Darstellung im PDF
