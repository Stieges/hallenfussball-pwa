# Hallenfußball PWA

Eine Progressive Web App für Turnierverwaltung - von der Spielplan-Erstellung bis zur Live-Ergebnisverfolgung.

**Repository:** https://github.com/Stieges/hallenfussball-pwa

---

## Inhaltsverzeichnis

- [Projekt-Setup](#projekt-setup)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Fair Scheduler](#fair-scheduler)
- [Design System](#design-system)
- [Verfügbare Scripts](#verfügbare-scripts)
- [Lizenz](#lizenz)

---

## Projekt-Setup

### Voraussetzungen

- Node.js v18+
- npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Die App läuft auf `http://localhost:3000`

### Production Build

```bash
npm run build
npm run preview
```

---

## Features

### Implementiert

| Feature | Beschreibung |
|---------|--------------|
| **Tournament Wizard** | 5-Schritt-Assistent zur Turniererstellung |
| **Fair Scheduler** | Algorithmus für faire Pausen- und Spielzeitverteilung |
| **Live-Verwaltung** | Match Cockpit mit Timer, Tor-Buttons, Event-Historie |
| **Gruppenphase + Playoffs** | 2/4 Gruppen mit konfigurierbaren Finals |
| **Schedule Editor** | Spielplan nachträglich bearbeiten (Drag & Drop) |
| **PDF-Export** | Spielpläne, Ergebnisse, Tabellen |
| **Import (JSON/CSV)** | Turniere und Teams importieren |
| **QR-Code** | Für Turnier-Sharing |
| **PWA** | Offline-fähig, installierbar |
| **Responsive** | Mobile-First mit 3 Breakpoints |
| **WCAG AA** | Alle Kontraste validiert |

### In Entwicklung

- Monitor-Ansicht für Großbildschirm (TV-Modus)
- Public View (Zuschauer-Link)

### Geplant

- Multi-User mit Rollen (Trainer, Fan, Turnierleitung)
- Cloud-Sync (Supabase)
- Push Notifications

---

## Tech Stack

### Core

| Technologie | Version | Zweck |
|-------------|---------|-------|
| React | 18 | UI Framework |
| TypeScript | 5 | Type Safety |
| Vite | 5 | Build Tool + HMR |

### Libraries

| Library | Zweck |
|---------|-------|
| jsPDF + AutoTable | PDF-Generierung |
| @dnd-kit | Drag & Drop (Schedule Editor) |
| qrcode | QR-Code Generierung |
| vite-plugin-pwa | PWA/Offline Support |

### Testing & Quality

| Tool | Zweck |
|------|-------|
| Vitest | Unit Tests |
| Testing Library | React Component Tests |
| ESLint | Linting |
| Husky + lint-staged | Pre-commit Hooks |

### Persistence

- **localStorage** - Browser-basierte Datenspeicherung
- **IndexedDB** (via PWA) - Offline-Cache

---

## Projektstruktur

```
src/
├── components/
│   ├── ui/                    # Basis-Komponenten (Button, Card, Input...)
│   ├── schedule/              # Spielplan-Komponenten
│   ├── match-cockpit/         # Live-Spielsteuerung
│   └── dialogs/               # Modale Dialoge
│
├── features/
│   ├── tournament-creation/   # Wizard Steps 1-5
│   ├── tournament-management/ # Tabs (Spielplan, Tabelle, Ranking)
│   └── schedule-editor/       # Spielplan-Editor (Drag & Drop)
│
├── design-tokens/             # Single Source of Truth für Styling
│   ├── colors.ts              # Farbpalette (WCAG-validiert)
│   ├── spacing.ts             # 8pt Grid
│   ├── typography.ts          # Schriftgrößen & Gewichte
│   ├── shadows.ts             # Schatten
│   ├── radii.ts               # Border Radius
│   ├── motion.ts              # Animationen
│   └── index.ts               # Zentrale Exports
│
├── hooks/                     # Custom React Hooks
│   ├── useTournaments.ts      # CRUD Operations
│   ├── useTournamentWizard.ts # Wizard State Management
│   ├── useLiveMatches.ts      # Live-Match State
│   ├── useMatchTimer.ts       # Timer-Logik
│   ├── useAutoSave.ts         # Automatisches Speichern
│   ├── useIsMobile.ts         # Responsive Detection
│   └── ...                    # 21 Hooks insgesamt
│
├── utils/
│   ├── fairScheduler.ts       # Kern-Scheduling-Algorithmus
│   ├── playoffScheduler.ts    # Playoff-Match-Generierung
│   ├── tournamentImporter.ts  # JSON/CSV Import
│   └── storage.ts             # localStorage Wrapper
│
├── lib/
│   ├── scheduleGenerator.ts   # Zeit-basierte Integration
│   └── pdfExporter.ts         # PDF-Export
│
├── types/
│   └── tournament.ts          # TypeScript Definitionen
│
├── contexts/                  # React Context Providers
├── config/                    # App-Konfiguration
├── services/                  # Service Layer
├── constants/                 # Konstanten & Schemas
├── screens/                   # Screen-Komponenten
├── styles/                    # Legacy Styles (migriert zu design-tokens)
└── test/                      # Test Utilities
```

### Wichtige Dateien

| Priorität | Datei | Beschreibung |
|-----------|-------|--------------|
| ⭐⭐⭐ | `src/utils/fairScheduler.ts` | Kern-Scheduling-Algorithmus |
| ⭐⭐⭐ | `src/utils/playoffScheduler.ts` | Playoff-Logik |
| ⭐⭐⭐ | `src/lib/scheduleGenerator.ts` | Zeit-basierte Integration |
| ⭐⭐ | `src/types/tournament.ts` | Datenstruktur-Definitionen |
| ⭐⭐ | `src/design-tokens/` | Design System |

---

## Fair Scheduler

Das Herzstück der App - sorgt für **faire Verteilung von Pausen und Spielzeiten**.

### Prioritäten

1. **Pausen-Fairness** (höchste) - Minimierung der Varianz zwischen Teams
2. **Home/Away Balance** - Ausgeglichene Heim/Auswärts-Verteilung
3. **Feld-Verteilung** - Teams spielen auf verschiedenen Feldern

### Algorithmus

```
1. Round-Robin Pairing Generation (Circle Method)
2. Greedy Scheduling mit Fairness-Heuristik
3. Home/Away Balancing (Post-Processing)
```

### Ergebnis

```
Vorher (ohne Fair Scheduler):
Team 1: Ø 48 min Pause | Team 8: Ø 18 min Pause
Spannweite: 30 min (unfair!)

Nachher (mit Fair Scheduler):
Team 1: Ø 30 min Pause | Team 8: Ø 30 min Pause
Spannweite: ~6 min (fair!)
```

Detaillierte Dokumentation: [docs/concepts/FAIR_SCHEDULER.md](docs/concepts/FAIR_SCHEDULER.md)

---

## Design System

Zentralisierte Styling-Werte in `src/design-tokens/`:

```typescript
import { colors, spacing, fontSizes, borderRadius } from '@/design-tokens';

// Farben (WCAG AA validiert)
colors.primary        // #00E676 (Grün)
colors.textPrimary    // #F5F5F5
colors.background     // #1A1A2E

// Spacing (8pt Grid)
spacing.xs   // 4px
spacing.sm   // 8px
spacing.md   // 16px
spacing.lg   // 24px
spacing.xl   // 32px

// Typography
fontSizes.sm   // 12px
fontSizes.md   // 14px
fontSizes.lg   // 16px
```

**Regel:** Keine hardcoded Werte - immer Design Tokens verwenden!

---

## Verfügbare Scripts

```bash
# Development
npm run dev           # Dev Server (Port 3000)
npm run build         # Production Build
npm run preview       # Preview Production Build

# Testing
npm run test          # Vitest (watch mode)
npm run test:ui       # Vitest mit UI

# Code Quality
npm run lint          # ESLint
npm run lint:fix      # ESLint mit Auto-Fix

# Analysis
npm run analyze       # Bundle-Größen-Analyse (öffnet stats.html)
```

---

## Responsive Design

### Breakpoints

```
Mobile:   < 768px   (Card-basierte Layouts)
Tablet:   768-1024px (Kompakte Tabellen)
Desktop:  > 1024px   (Vollständige Tabellen)
```

### Touch-Targets

- Minimum: 44x44px (WCAG 2.1 Level AA)
- Buttons: 48x48px
- Score-Inputs: 60x48px

---

## Lizenz

**MIT License mit Commons Clause**

- ✅ Privater Gebrauch, Modifikation, Fork
- ✅ Nutzung in Vereinen, Schulen, Non-Profit
- ❌ Verkauf oder Hosting als kommerzieller Dienst

Siehe [LICENSE](LICENSE) für den vollständigen Text.

---

## Autor

**Daniel Stiegler** - [@Stieges](https://github.com/Stieges)

---

## Acknowledgments

- Fair Scheduler Algorithmus entwickelt mit **Claude Code (Opus 4.5)**
- Circle Method basiert auf klassischen Round-Robin-Algorithmen

---

**Letzte Aktualisierung:** 2025-12-27
