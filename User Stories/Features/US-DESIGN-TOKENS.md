# US-DESIGN-TOKENS: Zentralisiertes Design Token System

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-DESIGN-TOKENS |
| **Priorität** | High |
| **Status** | In Progress (~60%) |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Design System / Architektur |
| **Impact** | Hoch - Grundlage für konsistentes Design |
| **Aufwand** | 8-12 Stunden (Restaufwand: 4-6h) |

---

## User Story

**Als** Entwickler
**möchte ich** alle Design-Werte (Farben, Abstände, Typografie, etc.) an einem zentralen Ort definiert haben
**damit** ich konsistente UI-Komponenten erstellen kann und Änderungen am Design nur an einer Stelle vornehmen muss

---

## Kontext

### Aktueller Zustand

Design-Werte sind aktuell auf mehrere Dateien verteilt:

```
├── src/styles/global.css        # CSS Variables (Farben, einige Spacing)
├── src/styles/theme.ts          # TypeScript Theme Object (Teilmenge)
├── *.module.css                 # Hardcoded Werte (px, Farben)
├── src/components/ui/*.tsx      # Inline-Styles mit Magic Numbers
```

### Probleme

1. **Inkonsistenz:** Gleiche Werte unterschiedlich definiert (`#00E676` vs `var(--color-primary)` vs `theme.colors.primary`)
2. **Keine Single Source of Truth:** Änderung erfordert Suchen in mehreren Dateien
3. **Keine Typisierung:** CSS Variables sind nicht typensicher
4. **Schwer wartbar:** Magic Numbers in Komponenten versteckt
5. **Keine Dokumentation:** Welche Werte sind "offiziell"?

### Best Practices 2024/2025

| Aspekt | Best Practice | Euer Status |
|--------|--------------|-------------|
| Single Source of Truth | Ein zentrales Token-File | Verteilt |
| Semantic Naming | `color-primary` statt `#00E676` | Teilweise |
| Kategorisierung | Colors, Spacing, Typography, Shadows, Motion | Teilweise |
| Typisierung | TypeScript-basiert | Nur theme.ts |
| CSS Custom Properties | Für Runtime-Theming | Ja |
| Dokumentation | Storybook / Style Guide | Nein |

---

## Acceptance Criteria

### Basis-Funktionalität

1. **AC1 - Zentrales Token File:** Given ich öffne das Projekt, When ich nach Design-Werten suche, Then finde ich alle in `src/design-tokens/` oder `src/tokens/`.

2. **AC2 - Typisierte Tokens:** Given ich importiere Tokens in TypeScript, When ich auf einen Token zugreife, Then bekomme ich TypeScript-Autocomplete und Type-Checking.

3. **AC3 - CSS Variable Generation:** Given ich definiere einen Token, When der Build läuft, Then wird eine entsprechende CSS Custom Property generiert.

4. **AC4 - Keine Magic Numbers:** Given ich suche nach hardcoded Pixel-Werten in Komponenten, Then finde ich maximal 5 Ausnahmen (mit Kommentar begründet).

5. **AC5 - Semantic Naming:** Given ich lese einen Token-Namen, Then verstehe ich seine Bedeutung (z.B. `spacing-lg` statt `spacing-16`).

### Erweiterte Funktionalität

6. **AC6 - Token Kategorien:** Given das Token-System, Then enthält es folgende Kategorien:
   - Colors (mit Semantic Aliases)
   - Spacing (8pt Grid basiert)
   - Typography (Scales, Weights, Line Heights)
   - Shadows
   - Border Radius
   - Motion (Duration, Easing)
   - Breakpoints

7. **AC7 - Theme.ts Deprecation:** Given die neuen Tokens, When ich theme.ts durchsuche, Then verweist es auf das zentrale Token-System (oder ist entfernt).

8. **AC8 - Global.css Sync:** Given ich ändere einen Token, Then wird global.css automatisch aktualisiert (Build-Prozess) ODER global.css importiert die Tokens direkt.

9. **AC9 - Dokumentation:** Given ein neuer Entwickler, When er die Tokens kennenlernen will, Then findet er eine README.md mit Übersicht und Nutzungsbeispielen.

---

## UX-Hinweise

Nicht direkt UX-relevant, aber indirekt:
- **Konsistenz:** Einheitliche Tokens führen zu konsistenter UI
- **Schnellere Iteration:** Designer-Feedback kann schneller umgesetzt werden
- **Weniger Bugs:** Typisierung verhindert Tippfehler

---

## Technische Hinweise

### Vorgeschlagene Architektur

```
src/
├── design-tokens/
│   ├── index.ts              # Haupt-Export
│   ├── colors.ts             # Farbpalette
│   ├── spacing.ts            # 8pt Grid Spacing
│   ├── typography.ts         # Font Sizes, Weights, Line Heights
│   ├── shadows.ts            # Box Shadows
│   ├── radii.ts              # Border Radius
│   ├── motion.ts             # Transitions, Animations
│   ├── breakpoints.ts        # Responsive Breakpoints
│   └── generated/
│       └── css-variables.css # Auto-generierte CSS Variables
```

### 1. Color Tokens

```typescript
// src/design-tokens/colors.ts

// Primitive Colors (nicht direkt verwenden)
const primitives = {
  green: {
    50: '#E8FFF0',
    100: '#C6FFD9',
    200: '#8FFDB8',
    300: '#4DF997',
    400: '#00E676',  // Primary
    500: '#00B862',
    600: '#008F4C',
    700: '#006637',
    800: '#003D21',
    900: '#00140B',
  },
  blue: {
    50: '#E6F7FF',
    100: '#BAE7FF',
    200: '#91D5FF',
    300: '#69C0FF',
    400: '#40A9FF',
    500: '#00B0FF',  // Secondary
    600: '#0096E6',
    700: '#007ACC',
    800: '#005EB3',
    900: '#004299',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
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
  red: {
    400: '#FF5252',  // Error
    500: '#EF4444',
    600: '#DC2626',
  },
  orange: {
    400: '#FF9100',  // Warning
    500: '#F97316',
  },
  // ... weitere Paletten
} as const;

// Semantic Colors (diese verwenden!)
export const colors = {
  // Brand
  primary: primitives.green[400],
  primaryHover: primitives.green[500],
  primaryActive: primitives.green[600],

  secondary: primitives.blue[500],
  secondaryHover: primitives.blue[600],

  tertiary: '#BB86FC',  // NEU: Material Design 3

  // Background
  background: primitives.neutral[950],
  surface: primitives.neutral[800],
  surfaceHover: 'rgba(255, 255, 255, 0.1)',
  surfaceVariant: primitives.neutral[700],

  // Text
  textPrimary: primitives.neutral[0],
  textSecondary: '#A3B8D4',  // Angepasst für WCAG AA
  textTertiary: primitives.neutral[500],
  textDisabled: primitives.neutral[600],

  // Border
  border: primitives.neutral[700],
  borderLight: primitives.neutral[600],

  // Semantic
  error: primitives.red[400],
  errorHover: primitives.red[500],
  warning: primitives.orange[400],
  success: '#4CAF50',
  info: primitives.blue[500],

  // On-Colors (Text auf farbigem Hintergrund)
  onPrimary: '#003300',  // Dunkel auf Grün
  onSecondary: '#001F33',
  onError: primitives.neutral[0],
  onWarning: '#000000',  // Schwarz auf Orange
  onSuccess: primitives.neutral[0],

  // Status (für Turnier)
  statusLive: primitives.blue[500],
  statusUpcoming: '#4CAF50',
  statusFinished: primitives.neutral[500],
  statusDraft: primitives.orange[400],

  // Special
  overlay: 'rgba(0, 0, 0, 0.5)',
  focus: primitives.green[400],
} as const;

export type ColorToken = keyof typeof colors;
```

### 2. Spacing Tokens (8pt Grid)

```typescript
// src/design-tokens/spacing.ts

export const spacing = {
  // Base unit: 8px
  px: '1px',      // Pixel-perfekt (nur für Borders)

  '0': '0',
  '0.5': '4px',   // 0.5 × 8 = 4px (Feintuning)
  '1': '8px',     // 1 × 8 = 8px (Basis)
  '1.5': '12px',  // DEPRECATED: Nur für Migration
  '2': '16px',    // 2 × 8 = 16px
  '3': '24px',    // 3 × 8 = 24px
  '4': '32px',    // 4 × 8 = 32px
  '5': '40px',    // 5 × 8 = 40px
  '6': '48px',    // 6 × 8 = 48px
  '8': '64px',    // 8 × 8 = 64px
  '10': '80px',   // 10 × 8 = 80px
  '12': '96px',   // 12 × 8 = 96px
} as const;

// Semantic Spacing Aliases
export const spacingSemantics = {
  // Component Internals
  insetXs: spacing['0.5'],   // 4px - Icon padding
  insetSm: spacing['1'],     // 8px - Small padding
  insetMd: spacing['2'],     // 16px - Standard padding
  insetLg: spacing['3'],     // 24px - Large padding (Cards)
  insetXl: spacing['4'],     // 32px - Extra large

  // Stack (vertical)
  stackXs: spacing['0.5'],   // 4px
  stackSm: spacing['1'],     // 8px
  stackMd: spacing['2'],     // 16px
  stackLg: spacing['3'],     // 24px

  // Inline (horizontal)
  inlineXs: spacing['0.5'],  // 4px
  inlineSm: spacing['1'],    // 8px
  inlineMd: spacing['2'],    // 16px

  // Touch Target (WCAG)
  touchTarget: '44px',       // Minimum touch target

  // Layout
  sectionGap: spacing['4'],  // 32px zwischen Sections
  pageMargin: spacing['2'],  // 16px Seitenrand mobile
  pageMarginDesktop: spacing['3'], // 24px Seitenrand desktop
} as const;

export type SpacingToken = keyof typeof spacing;
```

### 3. Typography Tokens

```typescript
// src/design-tokens/typography.ts

export const fontFamilies = {
  heading: '"Bebas Neue", sans-serif',
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const;

export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// Material Design 3 inspirierte Scale
export const fontSizes = {
  // Display
  displayLg: '57px',
  displayMd: '45px',
  displaySm: '36px',

  // Headline
  headlineLg: '32px',
  headlineMd: '28px',
  headlineSm: '24px',

  // Title
  titleLg: '22px',
  titleMd: '16px',
  titleSm: '14px',

  // Body
  bodyLg: '16px',
  bodyMd: '14px',
  bodySm: '12px',

  // Label
  labelLg: '14px',
  labelMd: '12px',
  labelSm: '11px',
} as const;

// Line Heights (8pt Grid aligned)
export const lineHeights = {
  displayLg: '64px',   // 57 → 64 (8 × 8)
  displayMd: '52px',   // 45 → 52 (nicht exakt 8pt, aber nah)
  displaySm: '44px',   // 36 → 44

  headlineLg: '40px',  // 32 → 40 (8 × 5)
  headlineMd: '36px',  // 28 → 36
  headlineSm: '32px',  // 24 → 32 (8 × 4)

  titleLg: '28px',
  titleMd: '24px',     // 16 → 24 (8 × 3)
  titleSm: '20px',

  bodyLg: '24px',      // 16 → 24
  bodyMd: '20px',      // 14 → 20
  bodySm: '16px',      // 12 → 16 (8 × 2)

  labelLg: '20px',
  labelMd: '16px',
  labelSm: '16px',
} as const;

// Composite Typography Styles
export const typography = {
  displayLarge: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.displayLg,
    lineHeight: lineHeights.displayLg,
    fontWeight: fontWeights.normal,
    letterSpacing: '-0.25px',
  },
  displayMedium: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.displayMd,
    lineHeight: lineHeights.displayMd,
    fontWeight: fontWeights.normal,
  },
  displaySmall: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.displaySm,
    lineHeight: lineHeights.displaySm,
    fontWeight: fontWeights.normal,
  },

  headlineLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.headlineLg,
    lineHeight: lineHeights.headlineLg,
    fontWeight: fontWeights.semibold,
  },
  headlineMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.headlineMd,
    lineHeight: lineHeights.headlineMd,
    fontWeight: fontWeights.semibold,
  },
  headlineSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.headlineSm,
    lineHeight: lineHeights.headlineSm,
    fontWeight: fontWeights.semibold,
  },

  titleLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleLg,
    lineHeight: lineHeights.titleLg,
    fontWeight: fontWeights.medium,
  },
  titleMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleMd,
    lineHeight: lineHeights.titleMd,
    fontWeight: fontWeights.medium,
  },
  titleSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleSm,
    lineHeight: lineHeights.titleSm,
    fontWeight: fontWeights.medium,
  },

  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    lineHeight: lineHeights.bodyLg,
    fontWeight: fontWeights.normal,
  },
  bodyMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyMd,
    lineHeight: lineHeights.bodyMd,
    fontWeight: fontWeights.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    lineHeight: lineHeights.bodySm,
    fontWeight: fontWeights.normal,
  },

  labelLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelLg,
    lineHeight: lineHeights.labelLg,
    fontWeight: fontWeights.medium,
  },
  labelMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelMd,
    lineHeight: lineHeights.labelMd,
    fontWeight: fontWeights.medium,
  },
  labelSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelSm,
    lineHeight: lineHeights.labelSm,
    fontWeight: fontWeights.medium,
  },
} as const;

export type TypographyToken = keyof typeof typography;
```

### 4. Weitere Tokens

```typescript
// src/design-tokens/shadows.ts
export const shadows = {
  none: 'none',
  sm: '0 2px 4px rgba(0, 0, 0, 0.2)',
  md: '0 4px 12px rgba(0, 0, 0, 0.3)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.4)',
  xl: '0 12px 32px rgba(0, 0, 0, 0.5)',

  // Spezielle Schatten
  card: '0 4px 12px rgba(0, 0, 0, 0.3)',
  dialog: '0 8px 32px rgba(0, 0, 0, 0.5)',
  toast: '0 10px 25px rgba(0, 0, 0, 0.3), 0 4px 10px rgba(0, 0, 0, 0.2)',
  focus: '0 0 0 4px rgba(0, 230, 118, 0.2)',
} as const;

// src/design-tokens/radii.ts
export const radii = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',    // Angepasst von 12px (8pt Grid)
  xl: '24px',
  full: '9999px',
} as const;

// src/design-tokens/motion.ts
export const durations = {
  instant: '0ms',
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  slower: '500ms',
} as const;

export const easings = {
  linear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Material Design 3 Easings
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
  standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const transitions = {
  default: `all ${durations.normal} ${easings.easeInOut}`,
  fast: `all ${durations.fast} ${easings.easeInOut}`,
  slow: `all ${durations.slow} ${easings.easeInOut}`,
  color: `color ${durations.fast} ${easings.easeInOut}, background-color ${durations.fast} ${easings.easeInOut}`,
  transform: `transform ${durations.normal} ${easings.easeOut}`,
  opacity: `opacity ${durations.normal} ${easings.easeInOut}`,
} as const;

// src/design-tokens/breakpoints.ts
export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

export const mediaQueries = {
  mobile: `@media (max-width: ${breakpoints.mobile})`,
  mobileUp: `@media (min-width: ${breakpoints.mobile})`,
  tablet: `@media (min-width: ${parseInt(breakpoints.mobile) + 1}px) and (max-width: ${breakpoints.tablet})`,
  tabletUp: `@media (min-width: ${parseInt(breakpoints.mobile) + 1}px)`,
  desktop: `@media (min-width: ${parseInt(breakpoints.tablet) + 1}px)`,
  wide: `@media (min-width: ${breakpoints.wide})`,
} as const;
```

### 5. Haupt-Export

```typescript
// src/design-tokens/index.ts
export { colors, type ColorToken } from './colors';
export { spacing, spacingSemantics, type SpacingToken } from './spacing';
export {
  fontFamilies,
  fontWeights,
  fontSizes,
  lineHeights,
  typography,
  type TypographyToken
} from './typography';
export { shadows } from './shadows';
export { radii } from './radii';
export { durations, easings, transitions } from './motion';
export { breakpoints, mediaQueries } from './breakpoints';

// Convenience re-export as single object
import { colors } from './colors';
import { spacing, spacingSemantics } from './spacing';
import { typography, fontFamilies } from './typography';
import { shadows } from './shadows';
import { radii } from './radii';
import { transitions } from './motion';
import { breakpoints, mediaQueries } from './breakpoints';

export const tokens = {
  colors,
  spacing,
  spacingSemantics,
  typography,
  fontFamilies,
  shadows,
  radii,
  transitions,
  breakpoints,
  mediaQueries,
} as const;

export default tokens;
```

### 6. CSS Variable Generator (Build-Zeit)

```typescript
// scripts/generateCssVariables.ts
import { colors, spacing, shadows, radii, durations, easings } from '../src/design-tokens';
import fs from 'fs';

function generateCssVariables() {
  let css = ':root {\n';

  // Colors
  css += '  /* Colors */\n';
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    css += `  --color-${cssKey}: ${value};\n`;
  });

  // Spacing
  css += '\n  /* Spacing */\n';
  Object.entries(spacing).forEach(([key, value]) => {
    css += `  --spacing-${key}: ${value};\n`;
  });

  // Shadows
  css += '\n  /* Shadows */\n';
  Object.entries(shadows).forEach(([key, value]) => {
    css += `  --shadow-${key}: ${value};\n`;
  });

  // Radii
  css += '\n  /* Border Radius */\n';
  Object.entries(radii).forEach(([key, value]) => {
    css += `  --radius-${key}: ${value};\n`;
  });

  css += '}\n';

  fs.writeFileSync('src/design-tokens/generated/css-variables.css', css);
  console.log('CSS Variables generated successfully!');
}

generateCssVariables();
```

### 7. Migration Guide

```markdown
## Migration von altem System zu Design Tokens

### Phase 1: Imports ersetzen (Tag 1)

```typescript
// VORHER
import { theme } from '../styles/theme';
const color = theme.colors.primary;

// NACHHER
import { colors } from '../design-tokens';
const color = colors.primary;
```

### Phase 2: CSS Variables vereinheitlichen (Tag 2-3)

```css
/* VORHER - in global.css */
--color-primary: #00E676;

/* NACHHER - auto-generiert, in global.css importieren */
@import './design-tokens/generated/css-variables.css';
```

### Phase 3: Magic Numbers ersetzen (Tag 4-5)

```typescript
// VORHER
<div style={{ padding: '12px 16px' }}>

// NACHHER
import { spacing } from '../design-tokens';
<div style={{ padding: `${spacing['2']} ${spacing['2']}` }}>
// Oder mit Tailwind-artiger Utility
<div className="p-2">
```
```

---

## Betroffene Dateien

| Aktion | Dateien |
|--------|---------|
| **Neu erstellen** | `src/design-tokens/*.ts` |
| **Migrieren** | `src/styles/theme.ts` → deprecated/entfernen |
| **Aktualisieren** | `src/styles/global.css` → importiert generated CSS |
| **Refactoren** | Alle Komponenten mit Magic Numbers |

---

## Definition of Done

- [ ] `src/design-tokens/` Ordner mit allen Token-Dateien erstellt
- [ ] CSS Variable Generator implementiert und in Build integriert
- [ ] `theme.ts` deprecated oder entfernt
- [ ] `global.css` importiert generierte CSS Variables
- [ ] Mindestens 5 Komponenten auf neue Tokens migriert
- [ ] README.md mit Nutzungsdokumentation
- [ ] Keine TypeScript-Fehler
- [ ] Visuell keine Regression

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Große Codeänderung | Hoch | Mittel | Schrittweise Migration |
| Vergessene Stellen | Mittel | Niedrig | ESLint-Rule für Magic Numbers |
| Naming-Konflikte | Niedrig | Mittel | Klare Namenskonventionen |

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Konzeptdokument** | [DESIGN-SYSTEM-CONCEPT.md](../../docs/concepts/DESIGN-SYSTEM-CONCEPT.md) |
| **Blockiert von** | - |
| **Blockiert** | US-8PT-GRID, US-TYPOGRAPHY-SCALE |
| **Verwandt** | US-A11Y-CONTRAST, US-CORPORATE-COLORS |
| **Standards** | [Design Tokens W3C](https://tr.designtokens.org/format/), [Material Design 3](https://m3.material.io/) |

---

## Quellen

- [Creating a Design System in React](https://dev.to/kylixmedusa/creating-a-design-system-in-react-a-comprehensive-guide-5d22)
- [Material Design 3 Foundations](https://m3.material.io/foundations)
- [Design Tokens Format](https://tr.designtokens.org/format/)
- [Tailwind CSS Theme Config](https://v3.tailwindcss.com/docs/theme)
