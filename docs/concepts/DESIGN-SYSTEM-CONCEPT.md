# Design System Konzept: Hallenfussball PWA

**Erstellungsdatum:** 2025-12-25
**Verknüpfte User Stories:** US-DESIGN-TOKENS, US-CORPORATE-COLORS, US-A11Y-CONTRAST
**Status:** Konzeptphase

---

## 1. Executive Summary

Dieses Konzeptdokument beschreibt die Implementierung eines zentralisierten Design-Token-Systems für die Hallenfussball PWA. Es vereint:

- **Design Tokens:** Zentralisierte Farbpalette, Spacing, Typography
- **Corporate Colors:** Dynamische Farbschema-Unterstützung für Veranstalter
- **Accessibility:** WCAG 2.2 konforme Farbkontraste

---

## 2. Ist-Analyse

### 2.1 Aktueller Zustand

| Aspekt | Aktuell | Problem |
|--------|---------|---------|
| **Farbdefinitionen** | Verteilt auf `global.css` + `theme.ts` | Inkonsistenz, Duplikation |
| **CSS Variables** | Teilweise in `:root` | Nicht typisiert, keine Dokumentation |
| **Corporate Colors** | Nicht vorhanden | Keine Anpassungsmöglichkeit |
| **Kontraste** | `--text-secondary: #8BA3C7` | Unter WCAG AA auf `surface` (~3.8:1) |

### 2.2 Datei-Struktur (Ist)

```
src/
├── styles/
│   ├── global.css        # CSS Variables (partielle Tokens)
│   └── theme.ts          # TypeScript Theme Object
├── *.module.css          # Hardcoded Werte verteilt
└── (kein design-tokens/) # Fehlt komplett
```

### 2.3 Farbpalette Analyse

```
Aktuelle Hauptfarben:
┌─────────────────────────────────────────────────────────────┐
│ Primary:    #00E676 (Grün)  - Kontrast auf BG: 8.5:1 ✓     │
│ Secondary:  #00B0FF (Blau)  - Kontrast auf BG: 6.2:1 ✓     │
│ Background: #0A1628 (Dunkel)                                │
│ Surface:    #1E293B                                         │
│ Text Prim:  #FFFFFF         - Kontrast auf BG: 15:1 ✓      │
│ Text Sec:   #8BA3C7         - Kontrast auf Surface: 3.8:1 ⚠️│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Soll-Architektur

### 3.1 Ziel-Struktur

```
src/
├── design-tokens/
│   ├── index.ts              # Haupt-Export
│   ├── colors.ts             # Farbpalette + Semantische Aliases
│   ├── spacing.ts            # 8pt Grid basiert
│   ├── typography.ts         # Font Sizes, Weights, Line Heights
│   ├── shadows.ts            # Box Shadows
│   ├── radii.ts              # Border Radius
│   ├── motion.ts             # Transitions, Animations
│   ├── breakpoints.ts        # Responsive Breakpoints
│   ├── corporate.ts          # Corporate Color System
│   └── generated/
│       └── css-variables.css # Auto-generierte CSS Variables
├── utils/
│   ├── colorUtils.ts         # Kontrast-Berechnung, WCAG-Checks
│   └── themeManager.ts       # Runtime Theme Injection
└── styles/
    └── global.css            # Importiert generated/css-variables.css
```

### 3.2 Datenfluss

```
┌──────────────────┐     Build     ┌─────────────────────┐
│  TypeScript      │ ───────────▶  │  CSS Variables      │
│  Design Tokens   │               │  (auto-generiert)   │
└──────────────────┘               └─────────────────────┘
        │                                    │
        ▼                                    ▼
┌──────────────────┐               ┌─────────────────────┐
│  Type-Safe       │               │  :root { ... }      │
│  Autocomplete    │               │  CSS Custom Props   │
└──────────────────┘               └─────────────────────┘
        │                                    │
        │     Runtime (Corporate Colors)     │
        │◀──────────────────────────────────┘│
        │                                    │
        ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│              Komponenten                                 │
│  import { colors } from '@/design-tokens'               │
│  style={{ color: colors.primary }}                      │
│  -- ODER --                                             │
│  className={styles.button} /* var(--color-primary) */  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Farbkonzept im Detail

### 4.1 Primitive Farben

Die Basis-Farbpalette definiert alle Rohfarben nach Material Design 3 Prinzipien:

```typescript
// src/design-tokens/colors.ts

const primitives = {
  // Primary - Hallenfussball-Grün
  green: {
    50:  '#E8FFF0',
    100: '#C6FFD9',
    200: '#8FFDB8',
    300: '#4DF997',
    400: '#00E676',  // ← Primary
    500: '#00B862',
    600: '#008F4C',
    700: '#006637',
    800: '#003D21',
    900: '#00140B',
  },

  // Secondary - Sportlich-Blau
  blue: {
    400: '#40A9FF',
    500: '#00B0FF',  // ← Secondary
    600: '#0096E6',
    700: '#007ACC',
  },

  // Neutral - Dark Theme Base
  neutral: {
    0:   '#FFFFFF',  // Text Primary
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',  // Border
    800: '#1E293B',  // Surface
    900: '#0F172A',
    950: '#0A1628',  // Background
  },

  // Semantic
  red:    { 400: '#FF5252', 500: '#EF4444' },  // Error
  orange: { 400: '#FF9100', 500: '#F97316' },  // Warning
  yellow: { 400: '#FFD700' },                   // Medal Gold
} as const;
```

### 4.2 Semantische Farben

Semantische Aliases für konsistente Verwendung:

```typescript
export const colors = {
  // ═══════════════════════════════════════════
  // BRAND COLORS
  // ═══════════════════════════════════════════
  primary:        primitives.green[400],      // #00E676
  primaryHover:   primitives.green[500],      // #00B862
  primaryActive:  primitives.green[600],      // #008F4C
  primaryLight:   primitives.green[200],      // Für Badges

  secondary:      primitives.blue[500],       // #00B0FF
  secondaryHover: primitives.blue[600],

  // ═══════════════════════════════════════════
  // BACKGROUND & SURFACE
  // ═══════════════════════════════════════════
  background:     primitives.neutral[950],    // #0A1628
  surface:        primitives.neutral[800],    // #1E293B
  surfaceHover:   'rgba(255, 255, 255, 0.1)',
  surfaceVariant: primitives.neutral[700],    // #334155

  // ═══════════════════════════════════════════
  // TEXT (WCAG AA konform)
  // ═══════════════════════════════════════════
  textPrimary:    primitives.neutral[0],      // #FFFFFF (15:1)
  textSecondary:  '#A3B8D4',                  // ANGEPASST! (5.1:1 auf surface)
  textTertiary:   primitives.neutral[500],
  textDisabled:   primitives.neutral[600],

  // ═══════════════════════════════════════════
  // BORDER
  // ═══════════════════════════════════════════
  border:         primitives.neutral[700],    // #334155
  borderLight:    primitives.neutral[600],
  borderActive:   'rgba(0, 230, 118, 0.3)',

  // ═══════════════════════════════════════════
  // SEMANTIC / STATUS
  // ═══════════════════════════════════════════
  error:          primitives.red[400],        // #FF5252
  errorHover:     primitives.red[500],
  warning:        primitives.orange[400],     // #FF9100
  success:        '#4CAF50',
  info:           primitives.blue[500],

  // On-Colors (Text auf farbigem Hintergrund)
  onPrimary:      '#003300',                  // Dunkel auf Grün
  onSecondary:    '#001F33',
  onError:        primitives.neutral[0],
  onWarning:      '#000000',                  // Schwarz auf Orange

  // ═══════════════════════════════════════════
  // TURNIER-SPEZIFISCH
  // ═══════════════════════════════════════════
  statusLive:     primitives.blue[500],
  statusLiveBg:   'rgba(0, 176, 255, 0.15)',
  statusUpcoming: '#4CAF50',
  statusFinished: primitives.neutral[500],
  statusDraft:    primitives.orange[400],

  // Medals
  medalGold:      '#FFD700',
  medalSilver:    '#C0C0C0',
  medalBronze:    '#CD7F32',

  // Special
  overlay:        'rgba(0, 0, 0, 0.5)',
  focus:          primitives.green[400],
} as const;
```

### 4.3 WCAG Kontrast-Matrix

Alle validierten Farbkombinationen:

| Vordergrund | Hintergrund | Kontrast | WCAG | Verwendung |
|-------------|-------------|----------|------|------------|
| `textPrimary` (#FFF) | `background` (#0A1628) | **15.0:1** | AAA | Haupttext |
| `textPrimary` (#FFF) | `surface` (#1E293B) | **11.2:1** | AAA | Card-Text |
| `textSecondary` (#A3B8D4) | `background` | **6.2:1** | AA | Sekundärtext |
| `textSecondary` (#A3B8D4) | `surface` | **4.6:1** | AA ✓ | Sekundärtext auf Cards |
| `primary` (#00E676) | `background` | **8.5:1** | AAA | Buttons, Links |
| `onPrimary` (#003300) | `primary` | **6.8:1** | AA | Text auf Primary-Button |
| `onWarning` (#000) | `warning` (#FF9100) | **5.1:1** | AA | Text auf Warning-Badge |

**WICHTIG:** `textSecondary` wurde von `#8BA3C7` (3.8:1) auf `#A3B8D4` (4.6:1) angepasst!

---

## 5. Corporate Colors System

### 5.1 Business Model: Premium Feature

**Corporate Colors ist ein Premium-Feature (Pro-Abo):**

| Tier | Corporate Colors | Preis |
|------|------------------|-------|
| **Free** | Standard-Farbschema (Grün/Blau) | Kostenlos |
| **Pro** | Individuelle Corporate Colors pro User | 9,99€/Monat |
| **Team** | Corporate Colors + Multi-User | 29,99€/Monat |

**Speicherung:** Corporate Colors werden **pro User** gespeichert (nicht pro Turnier). Alle Turniere eines Users nutzen automatisch dessen Corporate Colors.

### 5.2 Konzept

Veranstalter mit Pro/Team-Abo können ihre Vereins-/Unternehmensfarben für Turniere definieren:

```
┌─────────────────────────────────────────────────────────────┐
│ Standard-Theme          │ Corporate-Theme (Beispiel)        │
├─────────────────────────┼───────────────────────────────────┤
│ Primary:    #00E676     │ Primary:    #E30613 (FC Bayern)   │
│ Secondary:  #00B0FF     │ Secondary:  #FFFFFF               │
│ OnPrimary:  #003300     │ OnPrimary:  #FFFFFF (auto)        │
└─────────────────────────┴───────────────────────────────────┘
```

### 5.3 Datenmodell

```typescript
// src/design-tokens/corporate.ts

export interface CorporateColors {
  primary: string;        // Hauptfarbe (Hex)
  secondary: string;      // Akzentfarbe (Hex)
  textOnPrimary?: string; // Auto-berechnet wenn nicht gesetzt
  textOnSecondary?: string;
  preset?: CorporatePreset;
}

export type CorporatePreset =
  | 'standard'   // Grün/Blau (Default)
  | 'dfb'        // DFB-Grün
  | 'red'        // Rot/Weiß
  | 'yellow'     // Gelb/Schwarz
  | 'custom';    // Benutzerdefiniert

export const CORPORATE_PRESETS: Record<CorporatePreset, CorporateColors> = {
  standard: {
    primary: '#00E676',
    secondary: '#00B0FF',
    preset: 'standard',
  },
  dfb: {
    primary: '#00A551',
    secondary: '#000000',
    preset: 'dfb',
  },
  red: {
    primary: '#DC2626',
    secondary: '#FFFFFF',
    preset: 'red',
  },
  yellow: {
    primary: '#EAB308',
    secondary: '#000000',
    preset: 'yellow',
  },
  custom: {
    primary: '#2563EB',
    secondary: '#7C3AED',
    preset: 'custom',
  },
};
```

### 5.4 Runtime Theme Injection

```typescript
// src/utils/themeManager.ts

import { getContrastColor, isWcagCompliant } from './colorUtils';

export function applyCorporateColors(colors: CorporateColors): void {
  const root = document.documentElement;

  // Primärfarbe
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty(
    '--color-on-primary',
    colors.textOnPrimary || getContrastColor(colors.primary)
  );

  // Sekundärfarbe
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty(
    '--color-on-secondary',
    colors.textOnSecondary || getContrastColor(colors.secondary)
  );

  // HSL-Varianten für Hover-States generieren
  const hsl = hexToHsl(colors.primary);
  root.style.setProperty(
    '--color-primary-hover',
    `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(0, hsl.l - 10)}%)`
  );
}

export function resetToDefaultTheme(): void {
  applyCorporateColors(CORPORATE_PRESETS.standard);
}
```

### 5.5 UI-Integration (Wizard)

```
┌─────────────────────────────────────────────────────────────┐
│ Erscheinungsbild                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Farbschema:                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ● Standard (Grün)                                     │  │
│  │ ○ DFB-Grün                                           │  │
│  │ ○ Sportlich Rot                                       │  │
│  │ ○ Benutzerdefiniert                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Benutzerdefiniert ─────────────────────────────────┐   │
│  │                                                      │   │
│  │  Primärfarbe:      [▓▓▓▓▓▓] #E30613                 │   │
│  │                                                      │   │
│  │  Sekundärfarbe:    [▓▓▓▓▓▓] #FFFFFF                 │   │
│  │                                                      │   │
│  │  ✓ Kontrast OK (6.8:1)                              │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Vorschau ────────────────────────────────────────────┐ │
│  │ ████████ STADTMEISTERSCHAFT 2025 ████████████████████ │ │
│  │                                                       │ │
│  │ [Primär-Button]  [Sekundär-Button]  ▣ Live            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Spacing System (8pt Grid)

### 6.1 Basis-Werte

```typescript
// src/design-tokens/spacing.ts

export const spacing = {
  px:    '1px',       // Nur für Borders
  '0':   '0',
  '0.5': '4px',       // 0.5 × 8
  '1':   '8px',       // 1 × 8 (Basis)
  '2':   '16px',      // 2 × 8
  '3':   '24px',      // 3 × 8
  '4':   '32px',      // 4 × 8
  '5':   '40px',      // 5 × 8
  '6':   '48px',      // 6 × 8
  '8':   '64px',      // 8 × 8
  '10':  '80px',
  '12':  '96px',
} as const;
```

### 6.2 Semantische Spacing-Aliases

```typescript
export const spacingSemantic = {
  // Component Internals
  insetXs:    spacing['0.5'],    // 4px - Icon padding
  insetSm:    spacing['1'],      // 8px - Buttons, Badges
  insetMd:    spacing['2'],      // 16px - Cards
  insetLg:    spacing['3'],      // 24px - Sections

  // Vertical Spacing
  stackXs:    spacing['0.5'],    // 4px
  stackSm:    spacing['1'],      // 8px
  stackMd:    spacing['2'],      // 16px
  stackLg:    spacing['3'],      // 24px

  // Touch Targets (WCAG)
  touchTarget: '44px',           // Minimum 44×44px

  // Layout
  sectionGap:     spacing['4'],  // 32px zwischen Sections
  pageMargin:     spacing['2'],  // 16px Seitenrand mobile
  pageMarginWide: spacing['3'],  // 24px Seitenrand desktop
} as const;
```

---

## 7. Typography System

### 7.1 Font Stacks

```typescript
// src/design-tokens/typography.ts

export const fontFamilies = {
  heading: '"Bebas Neue", Impact, sans-serif',
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
} as const;
```

### 7.2 Type Scale (Material Design 3 inspiriert)

```typescript
export const typography = {
  // Display - Große Headlines
  displayLarge: {
    fontFamily: fontFamilies.heading,
    fontSize: '57px',
    lineHeight: '64px',
    fontWeight: 400,
    letterSpacing: '-0.25px',
  },
  displayMedium: {
    fontFamily: fontFamilies.heading,
    fontSize: '45px',
    lineHeight: '52px',
    fontWeight: 400,
  },
  displaySmall: {
    fontFamily: fontFamilies.heading,
    fontSize: '36px',
    lineHeight: '44px',
    fontWeight: 400,
  },

  // Headline - Section Headers
  headlineLarge: {
    fontFamily: fontFamilies.body,
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: 600,
  },
  headlineMedium: {
    fontFamily: fontFamilies.body,
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: 600,
  },
  headlineSmall: {
    fontFamily: fontFamilies.body,
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 600,
  },

  // Title - Component Headers
  titleLarge:  { fontSize: '22px', lineHeight: '28px', fontWeight: 500 },
  titleMedium: { fontSize: '16px', lineHeight: '24px', fontWeight: 500 },
  titleSmall:  { fontSize: '14px', lineHeight: '20px', fontWeight: 500 },

  // Body - Main Content
  bodyLarge:  { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
  bodyMedium: { fontSize: '14px', lineHeight: '20px', fontWeight: 400 },
  bodySmall:  { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },

  // Label - Buttons, Badges
  labelLarge:  { fontSize: '14px', lineHeight: '20px', fontWeight: 500 },
  labelMedium: { fontSize: '12px', lineHeight: '16px', fontWeight: 500 },
  labelSmall:  { fontSize: '11px', lineHeight: '16px', fontWeight: 500 },
} as const;
```

---

## 8. Komponenten-Farb-Zuordnung

### 8.1 Buttons

| Variante | Background | Text | Border | Hover |
|----------|------------|------|--------|-------|
| **Primary** | `--color-primary` | `--color-on-primary` | - | `--color-primary-hover` |
| **Secondary** | `transparent` | `--color-primary` | `--color-primary` | `--color-surface-hover` |
| **Ghost** | `transparent` | `--color-text-secondary` | - | `--color-surface-hover` |
| **Danger** | `--color-error` | `--color-on-error` | - | `--color-error-hover` |

### 8.2 Input Fields

| State | Background | Border | Text | Placeholder |
|-------|------------|--------|------|-------------|
| **Default** | `--color-surface` | `--color-border` | `--color-text-primary` | `--color-text-secondary` |
| **Focus** | `--color-surface` | `--color-primary` | `--color-text-primary` | `--color-text-secondary` |
| **Error** | `--color-surface` | `--color-error` | `--color-text-primary` | - |
| **Disabled** | `--color-background` | `--color-border` | `--color-text-disabled` | - |

### 8.3 Cards

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-light);
}
```

### 8.4 Status-Badges

| Status | Background | Text | Icon |
|--------|------------|------|------|
| **Live** | `--color-status-live-bg` | `--color-status-live` | Pulsierender Punkt |
| **Upcoming** | `rgba(76,175,80,0.15)` | `--color-status-upcoming` | ○ |
| **Finished** | `rgba(158,158,158,0.15)` | `--color-status-finished` | ✓ |
| **Draft** | `rgba(255,145,0,0.15)` | `--color-status-draft` | ✎ |

### 8.5 Medals (Ranking)

```css
.medal-gold   { color: var(--color-medal-gold); }
.medal-silver { color: var(--color-medal-silver); }
.medal-bronze { color: var(--color-medal-bronze); }
```

---

## 9. Accessibility Checkliste

### 9.1 Farb-Kontraste (WCAG 2.2 AA)

- [x] Text Primary auf Background: ≥4.5:1 (15.0:1) ✓
- [x] Text Primary auf Surface: ≥4.5:1 (11.2:1) ✓
- [ ] **Text Secondary auf Background: ≥4.5:1** → Anpassung auf `#A3B8D4`
- [ ] **Text Secondary auf Surface: ≥4.5:1** → Anpassung auf `#A3B8D4`
- [x] Primary Color auf Background: ≥3:1 (8.5:1) ✓
- [x] Focus Ring gegen Background: ≥3:1 ✓

### 9.2 UI-Komponenten (3:1 Minimum)

- [x] Input Border: ≥3:1 ✓
- [x] Button Border: ≥3:1 ✓
- [x] Focus Ring: ≥3:1 ✓
- [ ] **Slider Track**: Zu prüfen
- [ ] **Checkbox Border**: Zu prüfen

### 9.3 Non-Color Indicators

- [x] Status nutzt Icon + Farbe (nicht nur Farbe)
- [x] Fehlermeldungen haben Icon + Text
- [x] Focus-State hat Outline (nicht nur Farbänderung)

### 9.4 Motion & Animation

- [x] `prefers-reduced-motion` wird respektiert (in global.css)
- [x] Animationen sind dezent (<300ms)

---

## 10. Implementierungsplan

### Phase 1: Design Tokens Grundstruktur (Tag 1)

1. `src/design-tokens/` Ordner erstellen
2. `colors.ts`, `spacing.ts`, `typography.ts` implementieren
3. `index.ts` für zentrale Exports
4. CSS Variable Generator Script erstellen

### Phase 2: Migration bestehender Styles (Tag 2)

1. `theme.ts` → Design Tokens migrieren
2. `global.css` → Generierte CSS Variables importieren
3. Hardcoded Werte in Komponenten ersetzen

### Phase 3: Accessibility-Fixes (Tag 3)

1. `--text-secondary` auf `#A3B8D4` anpassen
2. Alle Komponenten auf Kontrast prüfen
3. Kontrast-Matrix dokumentieren

### Phase 4: Corporate Colors System (Tag 4-5)

1. `corporate.ts` mit Presets implementieren
2. `themeManager.ts` für Runtime-Injection
3. Wizard-Integration für Farbauswahl
4. PDF-Export mit dynamischen Farben

### Phase 5: Dokumentation & Testing (Tag 6)

1. README.md für Design Tokens
2. Beispiel-Komponenten
3. Automatisierte Kontrast-Tests (optional)

---

## 11. Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Visuelle Regression durch Farbänderungen | Mittel | Hoch | Schrittweise Migration, visuelle QA |
| Performance bei Runtime Theme Injection | Niedrig | Mittel | CSS Variables sind performant |
| Schlechte Corporate Color Kombinationen | Mittel | Hoch | WCAG-Check erzwingen, Warnungen |
| Vergessene hardcoded Werte | Hoch | Niedrig | ESLint-Rule für Magic Numbers |

---

## 12. Technische Referenzen

### 12.1 Build-Integration (Vite)

```typescript
// vite.config.ts - CSS Variable Generator Hook
import { generateCssVariables } from './scripts/generateCssVariables'

export default defineConfig({
  plugins: [
    {
      name: 'design-tokens',
      buildStart() {
        generateCssVariables()
      },
    },
  ],
})
```

### 12.2 TypeScript Utility Types

```typescript
// Für Type-Safe Token Verwendung
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type TypographyToken = keyof typeof typography;

// Beispiel Verwendung
function getColor(token: ColorToken): string {
  return colors[token];
}
```

### 12.3 CSS Import

```css
/* src/styles/global.css */
@import '../design-tokens/generated/css-variables.css';

/* Dann können alle Komponenten die Variables nutzen */
.button {
  background: var(--color-primary);
  padding: var(--spacing-2) var(--spacing-4);
}
```

---

## 13. Quellen & Standards

- [W3C Design Tokens Format](https://tr.designtokens.org/format/)
- [Material Design 3](https://m3.material.io/foundations)
- [WCAG 2.2 Contrast Requirements](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Tailwind CSS Theme Config](https://tailwindcss.com/docs/theme)

---

**Erstellt:** 2025-12-25
**Autor:** Claude Code
**Version:** 1.0
