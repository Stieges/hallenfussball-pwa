# US-PRESENTATION: Präsentationsmodus für Monitore

## Meta

| Feld | Wert |
|------|------|
| **ID** | US-PRESENTATION |
| **Titel** | Konfigurierbarer Präsentationsmodus für Monitore |
| **Priorität** | Hoch |
| **Aufwand** | ~20-30h |
| **Abhängigkeiten** | US-STRAFBANK (für Strafbank-View) |
| **Ersetzt** | Bestehender MonitorTab |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** mehrere Präsentations-Konfigurationen für verschiedene Monitore erstellen und individuell anpassen können,
**damit** ich Zuschauern in der Halle auf verschiedenen Bildschirmen relevante Informationen zeigen kann.

---

## Akzeptanzkriterien

### AC-1: Tab-Umbenennung
- [ ] Der Tab "Monitor" wird zu "Präsentation" umbenannt
- [ ] Icon bleibt (Monitor-Symbol) oder wird zu Präsentations-Symbol

### AC-2: Multi-Konfiguration
- [ ] User kann beliebig viele Präsentations-Konfigurationen erstellen
- [ ] Jede Konfiguration hat einen benutzerdefinierten Namen (z.B. "Beamer Halle 1", "Eingangsbereich")
- [ ] Jede Konfiguration hat eine eigene URL zum Teilen (`/presentation/{configId}`)
- [ ] Konfigurationen können dupliziert, bearbeitet und gelöscht werden

### AC-3: Verfügbare Ansichten (Views)
Folgende Views stehen zur Auswahl:

| View | Beschreibung | Konfigurierbar |
|------|--------------|----------------|
| **Live-Match** | Aktuelles Spiel mit Timer (bestehende Ansicht) | Feld-Auswahl |
| **Gruppentabelle** | Tabelle einer oder mehrerer Gruppen | Gruppen-Auswahl |
| **Live-Ticker** | Chronologische Spielereignisse | Anzahl Events, Event-Typen |
| **Platzierungen** | Finale Platzierungen | - |
| **Nächstes Spiel** | Countdown zum nächsten Spiel | Feld-Filter |
| **Strafbank** | Aktuelle Strafen (Platzhalter bis US-STRAFBANK) | - |
| **Sponsoren** | Sponsor-Logos (Platzhalter für später) | - |

### AC-4: View-Konfiguration pro Präsentation
- [ ] User kann beliebig viele Views zu einer Präsentation hinzufügen
- [ ] Reihenfolge per Drag & Drop änderbar
- [ ] Pro View: Checkbox "Überspringen wenn leer"
- [ ] Views können entfernt werden

### AC-5: Anzeigemodus
- [ ] **Statisch**: Alle Views auf einer Seite (responsives Grid)
- [ ] **Diashow**: Views rotieren automatisch

### AC-6: Diashow-Einstellungen
- [ ] Quick-Select für Slide-Dauer: 5s / 10s / 15s / 30s / 60s
- [ ] Individuelle Dauer pro View überschreibbar
- [ ] Leere Views werden übersprungen (wenn aktiviert)

### AC-7: Grid-Layout (Statischer Modus)
- [ ] Automatisches Grid basierend auf Anzahl Views und Bildschirmgröße
- [ ] Responsive Anpassung (1 Spalte auf Mobile, 2-3 auf Tablet, 3-4 auf Desktop/TV)

### AC-8: Vorschau & Vollbild
- [ ] "Vorschau"-Button öffnet Präsentation im neuen Tab
- [ ] "Vollbild"-Button startet Vollbildmodus direkt
- [ ] Vollbild-Modus mit Auto-Hide für Controls

### AC-9: Live-Ticker View
- [ ] Zeigt alle Spielereignisse chronologisch (neueste oben)
- [ ] Event-Typen: Tore, Spielstart, Halbzeit, Spielende, Korrekturen
- [ ] Konfigurierbar: Anzahl sichtbarer Events (5/10/15/alle)
- [ ] Auto-Scroll bei neuen Events
- [ ] Gilt als "leer" wenn keine Events vorhanden

### AC-10: Daten-Synchronisation
- [ ] Polling alle 500ms (wie bestehend)
- [ ] Präsentation aktualisiert sich automatisch bei Änderungen

---

## Technisches Konzept

### Datenmodell

```typescript
// src/types/presentation.ts

interface PresentationConfig {
  id: string;
  tournamentId: string;
  name: string;                    // "Beamer Halle 1"
  createdAt: string;
  updatedAt: string;

  mode: 'static' | 'slideshow';
  defaultSlideDuration: number;    // Sekunden (5, 10, 15, 30, 60)

  views: PresentationView[];
}

interface PresentationView {
  id: string;
  type: ViewType;
  order: number;                   // Für Drag & Drop
  skipIfEmpty: boolean;
  slideDuration?: number;          // Override für Diashow
  config: ViewConfig;              // View-spezifische Einstellungen
}

type ViewType =
  | 'live-match'
  | 'group-table'
  | 'live-ticker'
  | 'placements'
  | 'next-match'
  | 'penalty-bench'
  | 'sponsors';

// View-spezifische Konfigurationen
interface LiveMatchViewConfig {
  fieldFilter?: number[];          // Welche Felder zeigen
}

interface GroupTableViewConfig {
  groupIds: string[];              // Welche Gruppen zeigen
}

interface LiveTickerViewConfig {
  maxEvents: number;               // 5, 10, 15, oder -1 für alle
  eventTypes: MatchEventType[];    // Filter für Event-Typen
}

interface NextMatchViewConfig {
  fieldFilter?: number[];
}

type ViewConfig =
  | LiveMatchViewConfig
  | GroupTableViewConfig
  | LiveTickerViewConfig
  | NextMatchViewConfig
  | Record<string, never>;         // Für Views ohne Config
```

### Storage

```typescript
// src/constants/storage.ts erweitern
STORAGE_KEYS = {
  // ...existing
  presentationConfigs: (tournamentId: string) =>
    `presentation-configs-${tournamentId}`,
};
```

### URL-Schema

```
/presentation/{configId}          // Öffentliche Präsentation
/presentation/{configId}?preview  // Vorschau-Modus (mit Edit-Button)
```

### Komponenten-Struktur

```
src/features/presentation/
├── PresentationTab.tsx              # Hauptcontainer (ersetzt MonitorTab)
├── components/
│   ├── ConfigList.tsx               # Liste aller Konfigurationen
│   ├── ConfigCard.tsx               # Einzelne Konfiguration
│   ├── ConfigEditor.tsx             # Bearbeitungs-Dialog
│   ├── ViewSelector.tsx             # View-Typ Auswahl
│   ├── ViewList.tsx                 # Sortierbare View-Liste
│   ├── ViewConfigPanel.tsx          # View-spezifische Einstellungen
│   ├── SlideshowSettings.tsx        # Diashow-Einstellungen
│   └── PreviewControls.tsx          # Vorschau/Vollbild Buttons
├── views/
│   ├── LiveMatchView.tsx            # Bestehend (refactored)
│   ├── GroupTableView.tsx           # Gruppentabellen
│   ├── LiveTickerView.tsx           # Event-Liste
│   ├── PlacementsView.tsx           # Platzierungen
│   ├── NextMatchView.tsx            # Nächstes Spiel
│   ├── PenaltyBenchView.tsx         # Strafbank (Platzhalter)
│   └── SponsorsView.tsx             # Sponsoren (Platzhalter)
├── hooks/
│   ├── usePresentationConfigs.ts    # CRUD für Configs
│   ├── useSlideshow.ts              # Slideshow-Logik
│   └── useLiveTicker.ts             # Event-Aggregation
└── screens/
    └── PresentationScreen.tsx       # Öffentliche Präsentation
```

### Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/App.tsx` | Neue Route `/presentation/{configId}` |
| `src/screens/TournamentManagementScreen.tsx` | Tab "Monitor" → "Präsentation", PresentationTab einbinden |
| `src/constants/storage.ts` | Neue Storage-Keys |
| `src/components/monitor/*` | Refactoring zu `src/features/presentation/views/` |

### Migration

1. Bestehender MonitorTab wird durch PresentationTab ersetzt
2. Alte Monitor-Komponenten werden zu Views refactored
3. Keine Daten-Migration nötig (neues Feature)

---

## UI-Mockups

### Präsentations-Tab (Übersicht)

```
┌─────────────────────────────────────────────────────────────┐
│ Präsentation                              [+ Neu erstellen] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📺 Beamer Halle 1                                       │ │
│ │ Diashow · 4 Ansichten · 15s pro Slide                   │ │
│ │                                                         │ │
│ │ [Vorschau] [Vollbild] [Link kopieren] [✏️] [🗑️]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📺 Eingangsbereich                                      │ │
│ │ Statisch · 2 Ansichten                                  │ │
│ │                                                         │ │
│ │ [Vorschau] [Vollbild] [Link kopieren] [✏️] [🗑️]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   + Neue Präsentation erstellen                           │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Konfigurations-Editor

```
┌─────────────────────────────────────────────────────────────┐
│ Präsentation bearbeiten                              [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Name: [Beamer Halle 1_________________]                     │
│                                                             │
│ Anzeigemodus:                                               │
│ ○ Statisch (Grid)    ● Diashow                             │
│                                                             │
│ ┌─ Diashow-Einstellungen ─────────────────────────────────┐ │
│ │ Standard-Dauer: [5s] [10s] [●15s] [30s] [60s]           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Ansichten:                              [+ Ansicht hinzu]   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ≡ 1. Live-Match                           ⏱️15s  [🗑️]   │ │
│ │   └ Felder: Alle                                        │ │
│ │   ☑ Überspringen wenn leer                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ≡ 2. Gruppentabelle                       ⏱️15s  [🗑️]   │ │
│ │   └ Gruppen: A, B                                       │ │
│ │   ☐ Überspringen wenn leer                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ≡ 3. Live-Ticker                          ⏱️10s  [🗑️]   │ │
│ │   └ Letzte 10 Events                                    │ │
│ │   ☑ Überspringen wenn leer                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ≡ 4. Nächstes Spiel                       ⏱️15s  [🗑️]   │ │
│ │   └ Felder: Alle                                        │ │
│ │   ☑ Überspringen wenn leer                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                    [Abbrechen] [Speichern]  │
└─────────────────────────────────────────────────────────────┘
```

### Ansicht-Auswahl Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ Ansicht hinzufügen                                   [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│ │   ⚽      │ │   📊      │ │   📜      │                  │
│ │Live-Match │ │Gruppen-   │ │Live-      │                  │
│ │           │ │tabelle    │ │Ticker     │                  │
│ └───────────┘ └───────────┘ └───────────┘                  │
│                                                             │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│ │   🏆      │ │   ⏭️      │ │   🚫      │                  │
│ │Platzier-  │ │Nächstes   │ │Strafbank  │                  │
│ │ungen      │ │Spiel      │ │(bald)     │                  │
│ └───────────┘ └───────────┘ └───────────┘                  │
│                                                             │
│ ┌───────────┐                                               │
│ │   🤝      │                                               │
│ │Sponsoren  │                                               │
│ │(bald)     │                                               │
│ └───────────┘                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Live-Ticker View

```
┌─────────────────────────────────────────────────────────────┐
│                      LIVE-TICKER                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  14:32  ⚽ TOR!  FC Bayern 2:1 TSV 1860                     │
│              Max Müller (#10)                               │
│                                                             │
│  14:28  🔄 KORREKTUR  FC Bayern 1:1 TSV 1860               │
│              (vorher 1:0)                                   │
│                                                             │
│  14:15  ⚽ TOR!  TSV 1860 1:1 FC Bayern                     │
│                                                             │
│  14:10  ⏸️ HALBZEIT  FC Bayern vs TSV 1860                  │
│                                                             │
│  14:02  ⚽ TOR!  FC Bayern 1:0 TSV 1860                     │
│                                                             │
│  14:00  🏁 ANPFIFF  FC Bayern vs TSV 1860                   │
│              Spiel 5 · Feld 1 · Gruppe A                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Statisches Grid (Beispiel 4 Views)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │     LIVE-MATCH      │  │   GRUPPENTABELLE    │          │
│  │                     │  │                     │          │
│  │  FC Bayern  2 : 1   │  │  #  Team      Pkt   │          │
│  │  TSV 1860           │  │  1  Bayern    6     │          │
│  │      ⏱️ 07:23       │  │  2  1860      4     │          │
│  │                     │  │  3  Löwen     3     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │    LIVE-TICKER      │  │   NÄCHSTES SPIEL    │          │
│  │                     │  │                     │          │
│  │ 14:32 ⚽ Bayern 2:1 │  │  ⏭️ In 3 Minuten    │          │
│  │ 14:28 🔄 Korrektur  │  │                     │          │
│  │ 14:15 ⚽ 1860 1:1   │  │  SC Freiburg        │          │
│  │                     │  │      vs.            │          │
│  └─────────────────────┘  │  VfB Stuttgart      │          │
│                           └─────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementierungsphasen

### Phase 1: Basis-Infrastruktur (4h)
- [ ] Types definieren (`presentation.ts`)
- [ ] Storage-Keys erweitern
- [ ] `usePresentationConfigs` Hook (CRUD)
- [ ] Tab umbenennen (Monitor → Präsentation)

### Phase 2: Konfigurations-UI (5h)
- [ ] `PresentationTab` mit ConfigList
- [ ] `ConfigCard` Komponente
- [ ] `ConfigEditor` Dialog
- [ ] `ViewSelector` Dialog
- [ ] `ViewList` mit Drag & Drop

### Phase 3: Views Refactoring (4h)
- [ ] Bestehende Monitor-Komponenten zu Views refactoren
- [ ] `LiveMatchView` (aus LiveMatchDisplay)
- [ ] `GroupTableView` (aus StandingsDisplay)
- [ ] `PlacementsView` (aus PlacementsTab)
- [ ] `NextMatchView` (aus NextMatchPreview)

### Phase 4: Neue Views (4h)
- [ ] `LiveTickerView` + `useLiveTicker` Hook
- [ ] `PenaltyBenchView` (Platzhalter)
- [ ] `SponsorsView` (Platzhalter)

### Phase 5: Präsentations-Screen (4h)
- [ ] `PresentationScreen` (öffentlich)
- [ ] Routing in App.tsx
- [ ] Statisches Grid-Layout
- [ ] `useSlideshow` Hook

### Phase 6: Diashow & Polish (4h)
- [ ] Slide-Übergänge
- [ ] Skip-if-empty Logik
- [ ] Fullscreen-Modus
- [ ] Vorschau-Modus
- [ ] Link-Sharing

### Phase 7: Test & Cleanup (3h)
- [ ] Alte MonitorTab entfernen
- [ ] Komponenten-Migration abschließen
- [ ] Edge Cases testen

---

## Offene Punkte

1. **Strafbank-View**: Abhängig von US-STRAFBANK - als Platzhalter implementieren
2. **Sponsoren-View**: Als Platzhalter für spätere Implementierung
3. **Torschützen im Ticker**: Wenn Trainer-Cockpit existiert, Namen anzeigen

---

## Abgrenzung

**In Scope:**
- Multi-Konfiguration System
- Alle definierten Views
- Diashow & Static Mode
- Responsive Grid

**Out of Scope:**
- Design-Customization (Farben, Logo) → Separates Feature
- Sponsoren-Upload → Separates Feature
- Strafbank-Logik → US-STRAFBANK
