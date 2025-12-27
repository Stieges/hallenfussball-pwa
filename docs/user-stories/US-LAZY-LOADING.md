# US-LAZY-LOADING: Code Splitting & Lazy Loading implementieren

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-LAZY-LOADING |
| **Priorität** | Medium |
| **Status** | Open |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Performance / Bundle-Optimierung |
| **Impact** | Mittel - Schnellere Initial Load Time |
| **Aufwand** | 1-2 Tage |

---

## User Story

**Als** Benutzer
**möchte ich** dass die App schnell lädt, auch auf langsamen Verbindungen
**damit** ich sofort mit der Nutzung beginnen kann

---

## Kontext & Auswirkungen

### Aktueller Zustand

```
Bundle-Größe (geschätzt):
├── main.js         ~500KB (alles in einem Bundle)
├── vendor.js       ~200KB (React, Libraries)
└── styles.css      ~50KB

Problem:
└── User lädt ALLES, auch wenn er nur Dashboard braucht
```

### Auswirkungen ohne Code Splitting

| Problem | Auswirkung | Schweregrad |
|---------|------------|-------------|
| Lange Initial Load | User sieht 3-5s weißen Bildschirm | Hoch |
| Viel Traffic | Unnötige Daten auf mobilen Netzen | Mittel |
| Keine Progressive Loading | Alles oder nichts | Mittel |
| Schlechte LCP/FCP Scores | SEO-Nachteile | Niedrig |

### Best Practices für Code Splitting (2024)

**Route-Based Splitting**

> "The most common and recommended approach is to split code at the route level. Each route becomes its own chunk that loads on demand."

**Component-Based Splitting**

> "Heavy components like charts, editors, or maps should be loaded lazily since they add significant weight to the bundle."

**Preloading Strategy**

> "Combine lazy loading with preloading on hover or viewport intersection to eliminate perceived loading time."

---

## Acceptance Criteria

### Phase 1: Route-Based Splitting

1. **AC1:** Given die App, When ich das Dashboard öffne, Then wird nur das Dashboard-Bundle geladen.

2. **AC2:** Given TournamentCreation, When ich sie öffne, Then wird sie als separates Chunk geladen.

3. **AC3:** Given TournamentManagement, When ich sie öffne, Then wird sie lazy geladen.

### Phase 2: Component-Based Splitting

4. **AC4:** Given schwere Komponenten (PDF-Export, Charts), When sie gebraucht werden, Then werden sie lazy geladen.

5. **AC5:** Given TV-Display-Modus, When aktiviert, Then wird er als separates Chunk geladen.

### Phase 3: Optimierung

6. **AC6:** Given Lighthouse-Audit, When ich die Performance messe, Then ist der LCP unter 2.5s.

7. **AC7:** Given das initiale Bundle, When ich es analysiere, Then ist es unter 200KB gzipped.

---

## Technische Hinweise

### 1. React.lazy für Routen

```typescript
// src/App.tsx
import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LoadingSpinner } from './components/ui/LoadingSpinner'

// Lazy-loaded Routes
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'))
const TournamentCreationScreen = lazy(() => import('./screens/TournamentCreationScreen'))
const TournamentManagementScreen = lazy(() => import('./screens/TournamentManagementScreen'))
const PublicTournamentView = lazy(() => import('./screens/PublicTournamentView'))

// Loading Fallback
const PageLoader = () => (
  <div className="page-loader">
    <LoadingSpinner size="large" />
    <p>Lädt...</p>
  </div>
)

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/create" element={<TournamentCreationScreen />} />
        <Route path="/tournament/:id/*" element={<TournamentManagementScreen />} />
        <Route path="/view/:id" element={<PublicTournamentView />} />
      </Routes>
    </Suspense>
  )
}
```

### 2. Named Chunks für besseres Debugging

```typescript
// Webpack Magic Comments für benannte Chunks
const TournamentCreationScreen = lazy(() =>
  import(/* webpackChunkName: "tournament-creation" */ './screens/TournamentCreationScreen')
)

const TournamentManagementScreen = lazy(() =>
  import(/* webpackChunkName: "tournament-management" */ './screens/TournamentManagementScreen')
)

// Vite Alternative - rollupOptions
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'pdf': ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
})
```

### 3. Component-Level Lazy Loading

```typescript
// src/features/tournament-management/MonitorTab.tsx
import React, { Suspense, lazy, useState } from 'react'

// Schwere Komponenten lazy laden
const TVDisplay = lazy(() => import('./components/TVDisplay'))
const PDFExporter = lazy(() => import('../../../lib/pdfExporter'))

export function MonitorTab() {
  const [isTVMode, setIsTVMode] = useState(false)
  const [showPDFDialog, setShowPDFDialog] = useState(false)

  return (
    <div className="monitor-tab">
      {/* Normal Content */}

      {/* TV-Modus lazy laden */}
      {isTVMode && (
        <Suspense fallback={<div className="tv-loader">TV-Modus wird geladen...</div>}>
          <TVDisplay onExit={() => setIsTVMode(false)} />
        </Suspense>
      )}

      {/* PDF-Export lazy laden */}
      {showPDFDialog && (
        <Suspense fallback={<div>PDF-Generator wird geladen...</div>}>
          <PDFExporter onClose={() => setShowPDFDialog(false)} />
        </Suspense>
      )}
    </div>
  )
}
```

### 4. Preloading für bessere UX

```typescript
// src/components/Navigation.tsx
import { Link, useLocation } from 'react-router-dom'

// Preload-Funktionen
const preloadTournamentCreation = () => {
  import('./screens/TournamentCreationScreen')
}

const preloadTournamentManagement = () => {
  import('./screens/TournamentManagementScreen')
}

export function Navigation() {
  return (
    <nav>
      <Link
        to="/create"
        onMouseEnter={preloadTournamentCreation}  // Preload on hover
        onFocus={preloadTournamentCreation}
      >
        Neues Turnier
      </Link>
    </nav>
  )
}
```

### 5. Intersection Observer Preloading

```typescript
// src/hooks/usePreloadOnVisible.ts
import { useEffect, useRef } from 'react'

export function usePreloadOnVisible(preloadFn: () => void) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            preloadFn()
            observer.disconnect()
          }
        })
      },
      { rootMargin: '100px' }  // Preload 100px before visible
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [preloadFn])

  return ref
}

// Verwendung
function TournamentCard({ tournament }) {
  const preloadRef = usePreloadOnVisible(() => {
    import('./screens/TournamentManagementScreen')
  })

  return (
    <div ref={preloadRef}>
      <Link to={`/tournament/${tournament.id}`}>
        {tournament.name}
      </Link>
    </div>
  )
}
```

### 6. Error Boundary für Lazy Components

```typescript
// src/components/LazyErrorBoundary.tsx
import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class LazyErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h3>Laden fehlgeschlagen</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>Erneut versuchen</button>
        </div>
      )
    }

    return this.props.children
  }
}

// Verwendung
function App() {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ... */}
        </Routes>
      </Suspense>
    </LazyErrorBoundary>
  )
}
```

### 7. Bundle Analyzer Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
})
```

```bash
# Installation
npm install -D rollup-plugin-visualizer

# Analyse ausführen
npm run build -- --mode analyze
```

---

## Erwartete Bundle-Struktur

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js          # ~50KB (Shell, Router)
│   ├── vendor-react-[hash].js   # ~120KB (React Core)
│   ├── vendor-ui-[hash].js      # ~30KB (UI Libraries)
│   ├── dashboard-[hash].js      # ~20KB (Dashboard)
│   ├── tournament-creation-[hash].js  # ~40KB
│   ├── tournament-management-[hash].js # ~80KB
│   ├── pdf-[hash].js            # ~100KB (nur bei Bedarf)
│   └── tv-display-[hash].js     # ~30KB (nur bei Bedarf)
│   └── index-[hash].css         # ~50KB
```

### Vorher vs. Nachher

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|--------------|
| Initial Bundle | ~500KB | ~200KB | -60% |
| First Load | 3-4s | 1-1.5s | -65% |
| LCP | 4s | 2s | -50% |
| TTI | 5s | 2.5s | -50% |

---

## Definition of Done

- [ ] React.lazy für alle Route-Komponenten
- [ ] Named Chunks konfiguriert (Vite)
- [ ] Suspense mit Loading-Fallbacks
- [ ] Error Boundary für Lazy Components
- [ ] Preloading für kritische Routen
- [ ] PDF-Export lazy loaded
- [ ] TV-Display lazy loaded
- [ ] Bundle-Analyse zeigt separate Chunks
- [ ] Initial Bundle < 200KB gzipped
- [ ] LCP < 2.5s auf 3G

---

## Quellen

- [React Lazy and Suspense](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#async-chunk-loading-optimization)
- [Web.dev Code Splitting](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
- [Preloading Critical Assets](https://web.dev/preload-critical-assets/)
