# Hallenfußball PWA

Eine modulare Progressive Web App für Hallenfußball-Turnierverwaltung mit React, TypeScript und Vite.

## 🚀 Projekt-Setup

### Voraussetzungen

- Node.js (v18 oder höher)
- npm oder yarn

### Installation

```bash
cd hallenfussball-pwa
npm install
```

### Development Server starten

```bash
npm run dev
```

Die App läuft dann auf `http://localhost:3000`

### Production Build erstellen

```bash
npm run build
```

### Preview des Production Builds

```bash
npm run preview
```

## 📁 Projektstruktur

```
hallenfussball-pwa/
├── src/
│   ├── components/          # Wiederverwendbare UI-Komponenten
│   │   └── ui/             # Button, Card, Input, Select, Icons
│   ├── features/           # Feature-spezifische Komponenten
│   │   └── tournament-creation/  # Wizard Steps
│   ├── hooks/              # Custom React Hooks
│   ├── screens/            # Screen-Komponenten (in Entwicklung)
│   ├── styles/             # Theme & Global Styles
│   ├── types/              # TypeScript Type Definitions
│   ├── utils/              # Helper-Funktionen
│   ├── App.tsx            # Haupt-App-Komponente
│   └── main.tsx           # Entry Point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🛠️ Tech Stack

- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **localStorage** - Datenpersistenz

## 📝 Aktueller Status

### ✅ Implementiert

- Vite + TypeScript Setup
- Projekt-Ordnerstruktur
- UI-Komponenten (Button, Card, Input, Select, Icons)
- Theme & Design Tokens
- TypeScript Type Definitions
- Utils (calculations, matchGenerator, storage)
- Custom Hooks (useTournaments, useLocalStorage)
- Basic App Shell mit Turnier-Liste
- Tournament Creation Step 1 (Sportart & Turniertyp)

### 🚧 In Arbeit

- Tournament Creation Steps 2-5
- TournamentCreationScreen (vollständiger Wizard)
- Weitere Screen-Komponenten
- Dashboard & Turnier-Management

## 🎯 Nächste Schritte

1. Restliche Tournament Creation Steps extrahieren und modularisieren
2. TournamentCreationScreen mit allen 5 Steps zusammenbauen
3. Dashboard & Score Entry Screens modularisieren
4. Public View & Admin Dashboard aufteilen
5. Testing & Optimierung

## 📦 Verfügbare Scripts

- `npm run dev` - Development Server
- `npm run build` - Production Build
- `npm run preview` - Preview Production Build
- `npm run lint` - ESLint ausführen

## 🔧 Konfiguration

Die App nutzt:
- **Vite Config**: `vite.config.ts`
- **TypeScript Config**: `tsconfig.json`, `tsconfig.node.json`
- **Theme**: `src/styles/theme.ts`
- **Global Styles**: `src/styles/global.css`

## 💾 Datenpersistenz

Alle Turnierdaten werden im Browser's `localStorage` gespeichert unter dem Key `hallenfussball_tournaments`.

## 🎨 Design System

Das Theme ist in `src/styles/theme.ts` definiert und bietet:
- Konsistente Farben & Gradients
- Spacing-System
- Typography-Scale
- Border-Radius Presets
- Box Shadows
