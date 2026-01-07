# Monitor-Konfigurator - Umsetzungsplan

> **Version:** 1.0
> **Erstellt:** 2026-01-03
> **Aktualisiert:** 2026-01-07
> **Projekt:** Hallenfussball PWA

---

## Executive Summary

Dieser Plan beschreibt die schrittweise Implementierung des Monitor-Konfigurators in **4 Phasen**. Das System ermoeglicht Turnierveranstaltern, beliebig viele Display-Konfigurationen zu erstellen und individuell mit Inhalten zu bespielen.

### Kernumfang

| Phase | Fokus | Tasks | Geschaetzte Dauer | Status |
|-------|-------|-------|-------------------|--------|
| **Phase 0** | Foundation | Datenmodell, Types, Migration | 2-3 Tage | ✅ Fertig |
| **Phase 1** | MVP Core | Konfigurator UI, 5 Slide-Typen, Display | 8-10 Tage | 🚧 In Arbeit |
| **Phase 2** | Extended | Restliche Slides, When Idle, Preview | 5-7 Tage | 📅 Geplant |
| **Phase 3** | Professional | Remote Control, Sync, Overlays | Nach Supabase | 📅 Geplant |

**Gesamt Phase 0-2: ca. 15-20 Arbeitstage**

### Kritischer Pfad

```
Types → Migration → Fields UI → Monitor CRUD → Slide Management → Display View
```

---

## Phasen-Uebersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0: FOUNDATION (2-3 Tage)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ • TypeScript Interfaces (TournamentMonitor, MonitorSlide, etc.)             │
│ • Tournament Type erweitern (monitors[], fields[], sponsors[])              │
│ • Migration-Logik fuer bestehende Turniere                                  │
│ • Display-spezifische Design Tokens                                         │
│ • Routing vorbereiten (neue Screen-Types)                                   │
│                                                                             │
│ Meilenstein: Datenmodell komplett, Migration funktioniert                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: MVP CORE (8-10 Tage)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Felder-Verwaltung (Einstellungen → Felder)                                │
│ • Monitor-Konfigurator UI (Reiter "Monitore")                               │
│ • Monitor CRUD (erstellen, bearbeiten, loeschen)                            │
│ • Slide-Management (hinzufuegen, sortieren, loeschen)                       │
│ • 5 Basis-Slide-Typen: Live, Standings, Schedule-Field, Sponsor, Custom     │
│ • Display-Ansicht mit Slideshow-Logik                                       │
│ • Fullscreen + Wake Lock                                                    │
│ • QR-Code Generierung + Link-Sharing                                        │
│                                                                             │
│ Meilenstein: Funktionierender Monitor von Konfiguration bis Display         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: EXTENDED (5-7 Tage)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Restliche Slide-Typen: All-Standings, Schedule-Group, Next-Matches,       │
│   Top-Scorers                                                               │
│ • When Idle Logik (fuer Live-Slides)                                        │
│ • Versteckte Steuerungsleiste                                               │
│ • Live-Preview im Konfigurator                                              │
│ • Drag & Drop fuer Slides                                                   │
│ • Sponsor-Verwaltung (eigener Bereich unter Einstellungen)                  │
│ • Asset-Caching (Service Worker)                                            │
│                                                                             │
│ Meilenstein: Professionelle UX mit allen Slide-Typen                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PROFESSIONAL (Nach Supabase-Migration)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Verbindungs-Status ("X Geraete online")                                   │
│ • Remote Control (alle Monitore gleichzeitig steuern)                       │
│ • Synchronisierte Diashows zwischen Monitoren                               │
│ • Overlays (Tor-Animation, Ticker)                                          │
│ • Impressions-Tracking fuer Sponsoren                                       │
│                                                                             │
│ Meilenstein: Enterprise-Features fuer grosse Events                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Foundation

### P0-01: TypeScript Interfaces definieren

**Beschreibung:** Alle neuen Types fuer Monitor-Konfigurator erstellen

**Abhaengigkeiten:** Keine

**Betroffene Dateien:**
- `src/types/tournament.ts` (erweitern)
- `src/types/monitor.ts` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 4 Stunden

**Akzeptanzkriterien:**
- [x] `TournamentField` Interface mit id, name, shortName, order
- [x] `Sponsor` Interface mit id, name, logoUrl, websiteUrl, tier
- [x] `TournamentMonitor` Interface mit id, name, slides[], settings
- [x] `MonitorSlide` Interface mit id, type, config, duration, order
- [x] `SlideConfig` Union Type fuer alle 9 Slide-Typen
- [x] `SlideType` Literal Union
- [x] `TransitionType` ('fade' | 'slide' | 'none')
- [x] `WhenIdleConfig` und `WhenIdleType`
- [x] `QrTargetType` ('tournament' | 'sponsor-website' | 'custom')
- [x] Default-Wert Konstanten exportiert

---

### P0-02: Tournament Type erweitern

**Beschreibung:** Bestehenden Tournament Type um monitors[], fields[], sponsors[] erweitern

**Abhaengigkeiten:** P0-01

**Betroffene Dateien:**
- `src/types/tournament.ts`

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 1 Stunde

**Akzeptanzkriterien:**
- [x] `Tournament` Interface hat optionale `monitors: TournamentMonitor[]`
- [x] `Tournament` Interface hat optionale `fields: TournamentField[]`
- [x] `Tournament` Interface hat optionale `sponsors: Sponsor[]`
- [x] Bestehende `numberOfFields` in Settings bleibt fuer Rueckwaertskompatibilitaet
- [x] TypeScript Build laeuft ohne Fehler

---

### P0-03: Migration-Logik implementieren

**Beschreibung:** Automatische Migration bestehender Turniere ohne fields[] Array

**Abhaengigkeiten:** P0-02

**Betroffene Dateien:**
- `src/utils/tournamentMigration.ts` (neu)
- `src/hooks/useTournaments.ts` (erweitern)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 3 Stunden

**Akzeptanzkriterien:**
- [x] `migrateTournamentFields()` Funktion erstellt
- [x] Migration wird beim Laden eines Turniers automatisch ausgefuehrt
- [x] Bestehende `numberOfFields` Setting wird in `fields[]` konvertiert
- [x] Default-Namen: "Hauptfeld", "Feld 2", "Feld 3", etc.
- [x] Migration ist idempotent (mehrfaches Ausfuehren aendert nichts)
- [ ] Unit Tests fuer Migration

---

### P0-04: Display Design Tokens

**Beschreibung:** TV/Monitor-optimierte Design Tokens hinzufuegen

**Abhaengigkeiten:** Keine

**Betroffene Dateien:**
- `src/design-tokens/display.ts` (neu)
- `src/design-tokens/index.ts` (erweitern)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 2 Stunden

**Akzeptanzkriterien:**
- [x] `displayTokens` Objekt mit TV-optimierten Werten
- [x] Grosse Schriftgroessen (Score: 120px, Timer: 64px, etc.)
- [x] Hoher Kontrast fuer helle Sporthallen
- [x] Smooth Transition-Werte
- [x] TV-optimiertes Spacing (Overscan beruecksichtigt)
- [x] Steuerungsleisten-Werte (height, background, buttonSize)
- [x] Export in design-tokens/index.ts

---

### P0-05: Routing vorbereiten

**Beschreibung:** Neue Screen-Types fuer Monitor-Konfigurator und Display-Ansicht

**Abhaengigkeiten:** Keine

**Betroffene Dateien:**
- `src/App.tsx`
- `src/screens/` (Platzhalter-Screens)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 2 Stunden

**Akzeptanzkriterien:**
- [x] Neuer ScreenType: 'monitor-display'
- [x] URL-Parsing fuer `/t/:tournamentId/monitor/:monitorId`
- [x] URL-Parsing fuer `/t/:tournamentId/monitors` (Konfigurator)
- [x] Lazy-Loading vorbereitet fuer MonitorDisplayScreen
- [x] Platzhalter-Komponenten ohne Funktionalitaet

---

## Phase 1: MVP Core

### P1-01: Felder-Verwaltung UI

**Beschreibung:** Neuer Bereich unter Einstellungen zum Verwalten von Spielfeldern

**Abhaengigkeiten:** P0-03

**Betroffene Dateien:**
- `src/features/tournament-management/components/SettingsTab/FieldManagement.tsx` (neu)
- `src/features/tournament-management/SettingsTab.tsx` (erweitern)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 4 Stunden

**Akzeptanzkriterien:**
- [x] Liste aller Felder mit Name, KurzName, Spielanzahl
- [x] Feld hinzufuegen Button
- [x] Feld bearbeiten (Name aendern)
- [x] Feld loeschen (mit Warnung wenn Spiele zugewiesen)
- [x] Drag & Drop zum Sortieren
- [ ] Validierung: Mindestens 1 Feld
- [ ] Hinweis-Box: "Spielplan muss neu generiert werden"

---

### P1-02: useMonitors Hook

**Beschreibung:** Custom Hook fuer Monitor-CRUD Operationen

**Abhaengigkeiten:** P0-01, P0-02

**Betroffene Dateien:**
- `src/hooks/useMonitors.ts` (neu)
- `src/hooks/index.ts` (erweitern)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 4 Stunden

**Akzeptanzkriterien:**
- [x] `useMonitors(tournamentId)` Hook
- [x] CRUD: create, read, update, delete Monitor
- [x] Slide-Operationen: add, remove, reorder Slides
- [x] Optimistisches Update mit Rollback bei Fehler
- [x] localStorage Persistenz
- [ ] Cross-Tab Sync via `useMultiTabSync`
- [x] TypeScript typisiert

---

### P1-03: Monitor-Konfigurator UI - Uebersicht

**Beschreibung:** Hauptansicht des Monitor-Konfigurators mit Liste aller Monitore

**Abhaengigkeiten:** P1-02

**Betroffene Dateien:**
- `src/features/monitor-configurator/MonitorConfiguratorPage.tsx` (neu)
- `src/features/monitor-configurator/components/MonitorList.tsx` (neu)
- `src/features/monitor-configurator/components/MonitorCard.tsx` (neu)
- `src/features/monitor-configurator/index.ts` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 5 Stunden

**Akzeptanzkriterien:**
- [x] Responsive Grid-Ansicht aller Monitore
- [x] MonitorCard zeigt: Name, Slide-Anzahl, Intervall, Mini-Vorschau
- [x] Quick-Actions: Bearbeiten, Link, QR-Code, Vorschau, Loeschen
- [x] "Neuen Monitor anlegen" Button
- [ ] "Standard-Monitor erstellen" Schnellstart
- [x] Leerzustand wenn keine Monitore
- [ ] Hilfe-Button mit Erklaerung

---

### P1-04: Monitor Editor Dialog

**Beschreibung:** Fullscreen-Dialog zum Bearbeiten eines Monitors

**Abhaengigkeiten:** P1-03

**Betroffene Dateien:**
- `src/features/monitor-configurator/components/MonitorEditor.tsx` (neu)
- `src/features/monitor-configurator/components/SlideList.tsx` (neu)
- `src/features/monitor-configurator/components/SlideCard.tsx` (neu)

**Komplexitaet:** Hoch

**Geschaetzter Aufwand:** 6 Stunden

**Akzeptanzkriterien:**
- [x] Name, Standard-Dauer, Uebergangs-Einstellungen
- [x] Slide-Liste mit Drag & Drop zum Sortieren
- [x] SlideCard zeigt: Typ-Icon, Titel, Dauer, Aktionen
- [x] "Slide hinzufuegen" Button
- [x] Speichern/Abbrechen Buttons
- [ ] Unsaved-Changes Warnung

---

### P1-05: Slide Type Selector

**Beschreibung:** Dialog zur Auswahl des Slide-Typs beim Hinzufuegen

**Abhaengigkeiten:** P1-04

**Betroffene Dateien:**
- `src/features/monitor-configurator/components/SlideTypeSelector.tsx` (neu)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 2 Stunden

**Akzeptanzkriterien:**
- [x] Kategorisierte Auswahl (Live & Spielplan, Tabellen & Statistik, Sponsor & Sonstiges)
- [x] Icon + Titel + Beschreibung pro Typ
- [x] Klick oeffnet typ-spezifischen Konfigurator
- [x] Responsive Grid-Layout
- [x] Schliessen-Button

---

### P1-06: Slide Konfiguratoren - Basis

**Beschreibung:** Konfigurationsdialoge fuer die 5 Basis-Slide-Typen

**Abhaengigkeiten:** P1-05

**Betroffene Dateien:**
- `src/features/monitor-configurator/components/SlideConfigurators/LiveSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/StandingsSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/ScheduleFieldSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/SponsorSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/CustomTextSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/index.ts` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 8 Stunden (je ~1.5h pro Typ)

**Akzeptanzkriterien:**

**LiveSlideConfig:**
- [ ] Feld-Auswahl Dropdown
- [ ] "Diashow pausieren waehrend Spiel laeuft" Checkbox
- [ ] When Idle Optionen (vorerst nur 'skip')
- [ ] Eigene Dauer oder Standard

**StandingsSlideConfig:**
- [ ] Gruppe-Auswahl Dropdown
- [ ] Eigene Dauer oder Standard

**ScheduleFieldSlideConfig:**
- [ ] Feld-Auswahl Dropdown
- [ ] Eigene Dauer oder Standard

**SponsorSlideConfig:**
- [ ] Sponsor-Auswahl oder "Neu anlegen"
- [ ] Inline Sponsor-Erstellung (Name, Logo-URL, Website)
- [ ] QR-Code Ziel Optionen
- [ ] "QR-Code anzeigen" Checkbox
- [ ] Eigene Dauer oder Standard

**CustomTextSlideConfig:**
- [ ] Headline Input
- [ ] Body Textarea
- [ ] Text-Ausrichtung (left/center/right)
- [ ] Hintergrundfarbe (optional)
- [ ] Eigene Dauer oder Standard

---

### P1-07: QR-Code Generierung

**Beschreibung:** QR-Code Generierung fuer Monitor-Links und Sponsor-URLs

**Abhaengigkeiten:** Keine

**Betroffene Dateien:**
- `src/utils/qrCodeGenerator.ts` (neu)
- `src/features/monitor-configurator/components/QRCodeDialog.tsx` (neu)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 3 Stunden

**Akzeptanzkriterien:**
- [ ] QR-Code Generierung mit `qrcode` Library
- [ ] Einstellbare Groesse (S/M/L)
- [ ] Download als PNG
- [ ] Drucken-Funktion
- [ ] Dialog zeigt QR-Code + URL

---

### P1-08: Link-Sharing Komponente

**Beschreibung:** UI zum Teilen von Monitor-Links

**Abhaengigkeiten:** P1-07

**Betroffene Dateien:**
- `src/features/monitor-configurator/components/ShareMonitorDialog.tsx` (neu)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 2 Stunden

**Akzeptanzkriterien:**
- [ ] Link-Anzeige mit Copy-Button
- [ ] QR-Code Button (oeffnet QRCodeDialog)
- [ ] "Im neuen Tab oeffnen" Button
- [ ] Hinweis: "Link oeffnet automatisch im Vollbildmodus"

---

### P1-09: Display-Ansicht - Grundgeruest

**Beschreibung:** Oeffentliche Display-Seite mit Slideshow-Engine

**Abhaengigkeiten:** P0-05, P1-02

**Betroffene Dateien:**
- `src/features/monitor-display/MonitorDisplayPage.tsx` (neu)
- `src/features/monitor-display/hooks/useSlideshow.ts` (neu)
- `src/features/monitor-display/components/TransitionWrapper.tsx` (neu)

**Komplexitaet:** Hoch

**Geschaetzter Aufwand:** 6 Stunden

**Akzeptanzkriterien:**
- [ ] Laedt Monitor-Konfiguration anhand URL
- [ ] Slideshow-Timer mit konfigurierbarem Intervall
- [ ] Smooth Transitions zwischen Slides (fade/slide/none)
- [ ] Aktueller Slide-Index State
- [ ] Pause/Resume Funktionalitaet
- [ ] Next/Previous Navigation

**Code-Beispiel:**

```typescript
// src/features/monitor-display/hooks/useSlideshow.ts

interface UseSlideshowReturn {
  currentSlide: MonitorSlide;
  currentIndex: number;
  totalSlides: number;
  timeRemaining: number;
  isPaused: boolean;
  isTransitioning: boolean;

  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  togglePause: () => void;
}

export function useSlideshow(
  monitor: TournamentMonitor,
  tournament: Tournament
): UseSlideshowReturn {
  // Implementation mit useEffect fuer Timer
}
```

---

### P1-10: Slide Renderer

**Beschreibung:** Komponente die den richtigen Slide-Typ rendert

**Abhaengigkeiten:** P1-09

**Betroffene Dateien:**
- `src/features/monitor-display/components/SlideRenderer.tsx` (neu)
- `src/features/monitor-display/components/slides/LiveSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/StandingsSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/ScheduleFieldSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/SponsorSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/CustomTextSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/index.ts` (neu)

**Komplexitaet:** Hoch

**Geschaetzter Aufwand:** 10 Stunden (je ~2h pro Slide-Typ)

**Akzeptanzkriterien:**

**SlideRenderer:**
- [ ] Switch-Case fuer alle Slide-Typen
- [ ] Props: slide, tournament, transition state
- [ ] Fallback fuer unbekannte Typen

**LiveSlide:**
- [ ] Zeigt aktuelles Spiel auf konfiguriertem Feld
- [ ] Nutzt bestehende LiveMatchDisplay Komponente
- [ ] Zeigt NoMatchDisplay wenn kein Spiel laeuft

**StandingsSlide:**
- [ ] Zeigt Tabelle der konfigurierten Gruppe
- [ ] Nutzt bestehende GroupTables Komponente
- [ ] TV-optimiertes Styling

**ScheduleFieldSlide:**
- [ ] Zeigt Spielplan des konfigurierten Felds
- [ ] Hervorgehobenes aktuelles/naechstes Spiel
- [ ] Auto-Scroll zum relevanten Spiel

**SponsorSlide:**
- [ ] Zeigt Sponsor-Logo gross zentriert
- [ ] QR-Code wenn konfiguriert
- [ ] Fallback zu Text wenn kein Logo

**CustomTextSlide:**
- [ ] Headline + Body Text
- [ ] Konfigurierte Ausrichtung
- [ ] Konfigurierte Hintergrundfarbe

---

### P1-11: Fullscreen + Wake Lock

**Beschreibung:** Automatischer Fullscreen und Screen Wake Lock

**Abhaengigkeiten:** P1-09

**Betroffene Dateien:**
- `src/features/monitor-display/hooks/useFullscreen.ts` (erweitern oder neu)
- `src/features/monitor-display/hooks/useWakeLock.ts` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 3 Stunden

**Akzeptanzkriterien:**
- [ ] Auto-Fullscreen bei Seitenaufruf (ausser `?fullscreen=false`)
- [ ] Wake Lock API um Display aktiv zu halten
- [ ] Re-acquire Wake Lock bei visibility change
- [ ] Graceful Fallback wenn APIs nicht verfuegbar
- [ ] Keyboard Shortcuts (F, F11, Escape)

---

### P1-12: Monitor-Reiter im Tournament Dashboard

**Beschreibung:** Integration des Monitor-Konfigurators ins Turnier-Dashboard

**Abhaengigkeiten:** P1-03

**Betroffene Dateien:**
- `src/features/tournament-management/TournamentManagementScreen.tsx`
- `src/features/tournament-management/MonitorConfigTab.tsx` (neu)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 2 Stunden

**Akzeptanzkriterien:**
- [x] Neuer Tab "Monitore" im Turnier-Dashboard
- [x] Tab zeigt MonitorConfiguratorPage eingebettet
- [x] Tab-Icon (TV/Monitor Symbol)
- [ ] Badge mit Monitor-Anzahl (optional)

---

## Phase 2: Extended

### P2-01: Restliche Slide-Typen

**Beschreibung:** Implementierung der verbleibenden 4 Slide-Typen

**Abhaengigkeiten:** P1-10

**Betroffene Dateien:**
- `src/features/monitor-configurator/components/SlideConfigurators/AllStandingsSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/ScheduleGroupSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/NextMatchesSlideConfig.tsx` (neu)
- `src/features/monitor-configurator/components/SlideConfigurators/TopScorersSlideConfig.tsx` (neu)
- `src/features/monitor-display/components/slides/AllStandingsSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/ScheduleGroupSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/NextMatchesSlide.tsx` (neu)
- `src/features/monitor-display/components/slides/TopScorersSlide.tsx` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 8 Stunden

**Akzeptanzkriterien:**

**AllStandingsSlide:**
- [ ] Grid-Layout aller Gruppen-Tabellen
- [ ] Responsive: 2 Spalten Desktop, 1 Spalte Mobile
- [ ] Kompakte Tabellenansicht

**ScheduleGroupSlide:**
- [ ] Spielplan einer Gruppe
- [ ] Ergebnisse + kommende Spiele

**NextMatchesSlide:**
- [ ] Konfigurierbare Anzahl (1-10)
- [ ] Countdown zum naechsten Spiel
- [ ] Feld-Anzeige

**TopScorersSlide:**
- [ ] Top 10 Torschuetzen
- [ ] Team-Logo, Name, Tore

---

### P2-02: When Idle Logik

**Beschreibung:** Intelligentes Verhalten fuer Live-Slides wenn kein Spiel laeuft

**Abhaengigkeiten:** P1-10

**Betroffene Dateien:**
- `src/features/monitor-display/components/IdleContent.tsx` (neu)
- `src/features/monitor-display/hooks/useSlideshow.ts` (erweitern)
- `src/features/monitor-display/components/slides/LiveSlide.tsx` (erweitern)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 5 Stunden

**Akzeptanzkriterien:**
- [ ] When Idle Typen: next-match, last-result, top-scorers, sponsor, skip
- [ ] "Naechstes Spiel" mit Countdown-Timer
- [ ] "Letztes Ergebnis" mit Torschuetzen (wenn verfuegbar)
- [ ] Timeout-Option: Nach X Sekunden trotzdem weiter
- [ ] Slideshow-Pause waehrend laufendem Spiel

---

### P2-03: Versteckte Steuerungsleiste

**Beschreibung:** Overlay-Steuerung die bei Interaktion erscheint

**Abhaengigkeiten:** P1-09

**Betroffene Dateien:**
- `src/features/monitor-display/components/DisplayControls.tsx` (neu)
- `src/features/monitor-display/hooks/useIdleDetection.ts` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 4 Stunden

**Akzeptanzkriterien:**
- [ ] Erscheint bei Mausbewegung oder Touch
- [ ] Verschwindet nach 3 Sekunden Inaktivitaet
- [ ] Zeigt: Monitor-Name, Slide X von Y, Zeit bis Wechsel
- [ ] Buttons: Zurueck, Pause/Play, Weiter, Vollbild
- [ ] Keyboard-Shortcuts funktionieren
- [ ] Smooth Fade-Animation

---

### P2-04: Live-Preview im Konfigurator

**Beschreibung:** Kleine Vorschau im Monitor-Editor

**Abhaengigkeiten:** P1-04, P1-10

**Betroffene Dateien:**
- `src/features/monitor-configurator/components/SlidePreview.tsx` (neu)

**Komplexitaet:** Mittel

**Geschaetzter Aufwand:** 4 Stunden

**Akzeptanzkriterien:**
- [ ] Zeigt den aktuell gewaehlten Slide als Miniatur
- [ ] Live-Updates bei Aenderung der Einstellungen
- [ ] Toggle zwischen Desktop-Scaling und Mobile-Scaling

---

### P2-05: Asset-Caching

**Beschreibung:** Service Worker Strategie fuer Bilder und Assets

**Abhaengigkeiten:** Keine

**Betroffene Dateien:**
- `vite.config.ts` (vite-plugin-pwa config)

**Komplexitaet:** Niedrig

**Geschaetzter Aufwand:** 2 Stunden

**Akzeptanzkriterien:**
- [ ] Sponsor-Logos werden gecached
- [ ] Offline-Faehigkeit fuer Monitor-Display
- [ ] Strategie: StaleWhileRevalidate

---

## Phase 3: Professional (Ausblick)

Nach der Migration zu Supabase:
- Remote Control via Websockets
- Synchronisierte Slideshows
- Live-Ticker Overlay
- Sponsor-Analytics
