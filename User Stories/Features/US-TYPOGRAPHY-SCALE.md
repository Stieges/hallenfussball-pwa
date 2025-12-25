# US-TYPOGRAPHY-SCALE: Material Design 3 Typography System

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TYPOGRAPHY-SCALE |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Design System |
| **Impact** | Hoch - Visuelle Hierarchie & Lesbarkeit |
| **Aufwand** | 6-8 Stunden |

---

## User Story

**Als** Nutzer der App
**möchte ich** eine klare visuelle Hierarchie mit gut lesbaren Texten erleben
**damit** ich Informationen schnell erfassen kann und wichtige Elemente sofort erkenne

---

## Kontext

### Warum Material Design 3 Typography?

1. **Forschungsbasiert:** Google's MD3 Typography basiert auf Usability-Studien
2. **Bewährt:** Verwendet von Milliarden Nutzern weltweit
3. **Systematisch:** 5 Kategorien × 3 Größen = 15 definierte Styles
4. **Barrierefrei:** Optimiert für Lesbarkeit und Accessibility
5. **Aktuell:** 2024/2025 aktualisiert mit "M3 Expressive"

### Aktueller Zustand vs. MD3

```
AKTUELL (7 Stufen)          MD3 (15 Stufen)
─────────────────────────   ─────────────────────────
xxxl: 32px                  Display (lg/md/sm): 57/45/36px
xxl: 24px                   Headline (lg/md/sm): 32/28/24px
xl: 18px                    Title (lg/md/sm): 22/16/14px
lg: 16px                    Body (lg/md/sm): 16/14/12px
md: 14px                    Label (lg/md/sm): 14/12/11px
sm: 12px
xs: 11px
```

**Probleme:**
- Keine klare semantische Zuordnung (wann nutze ich `xl` vs `xxl`?)
- Fehlende Abstufung für Headlines
- Keine Line-Height-Definition
- Inkonsistente Nutzung in Komponenten

### Sport-App Kontext

Sport-Apps haben besondere Anforderungen:
- **Scores:** Große, fette Zahlen (Display)
- **Team-Namen:** Mittelgroß, klar lesbar (Title)
- **Spielinfo:** Kompakt aber lesbar (Body)
- **Status-Labels:** Klein aber auffällig (Label)
- **Schnelles Scannen:** Klare Hierarchie für Turniertabellen

---

## Acceptance Criteria

### Basis-Funktionalität

1. **AC1 - Typography Tokens:** Given das Design Token System, When ich Typography-Styles suche, Then finde ich mindestens 15 definierte Styles (5 Kategorien × 3 Größen).

2. **AC2 - Semantische Namen:** Given ich einen Text style, When ich den Token-Namen sehe, Then verstehe ich seinen Verwendungszweck (z.B. `titleMedium` für Überschriften mittlerer Wichtigkeit).

3. **AC3 - Composite Styles:** Given einen Typography-Token, Then enthält er: `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing` (optional).

4. **AC4 - Line-Height Alignment:** Given alle Line-Heights, Then sind mindestens 80% auf das 8pt Grid ausgerichtet (16, 24, 32, 40, 48px).

5. **AC5 - Komponenten-Mapping:** Given UI-Komponenten (Button, Input, Card-Header, etc.), Then haben alle einen dokumentierten Typography-Token zugeordnet.

### Erweiterte Funktionalität

6. **AC6 - Responsive Typography:** Given die App auf Mobile vs Desktop, Then passen sich kritische Texte (Headlines, Scores) responsiv an.

7. **AC7 - Font Loading:** Given die App lädt, Then wird "Bebas Neue" für Headlines performant geladen (font-display: swap).

8. **AC8 - Fallback Fonts:** Given "Bebas Neue" lädt nicht, Then wird ein passender Fallback-Font verwendet (z.B. Impact, Arial Black).

9. **AC9 - Sport-Spezifische Styles:** Given Sport-spezifische Elemente (Scores, Timer), Then haben diese dedizierte Typography-Tokens.

---

## UX-Hinweise

### Visuelle Hierarchie Beispiel

```
┌─────────────────────────────────────────────────────────────┐
│                      TURNIER-ANSICHT                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  HALLENFUSSBALL-CUP 2025          ← displayMedium   │   │
│  │  (Bebas Neue, 45px)                                 │   │
│  │                                                     │   │
│  │  Gruppe A                          ← headlineMedium │   │
│  │  (28px, semibold)                                   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ FC Bayern        3 : 1        BVB Dortmund │   │   │
│  │  │ ← titleMedium    ↑            → titleMedium│   │   │
│  │  │   (16px)       displaySmall      (16px)    │   │   │
│  │  │                 (36px, bold)               │   │   │
│  │  │                                             │   │   │
│  │  │ Feld 1 • 10:30 - 10:37        ← bodySmall │   │   │
│  │  │ (12px, secondary color)                    │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  Status: LIVE                      ← labelMedium   │   │
│  │  (12px, uppercase, semibold)                        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Komponenten-Typography-Mapping

| Komponente | Element | Typography Token |
|------------|---------|------------------|
| **Button** | Text (sm) | labelMedium |
| **Button** | Text (md) | labelLarge |
| **Button** | Text (lg) | titleSmall |
| **Input** | Label | labelMedium |
| **Input** | Value | bodyMedium |
| **Input** | Placeholder | bodyMedium (secondary) |
| **Input** | Error | bodySmall |
| **Card** | Title | titleLarge |
| **Card** | Subtitle | bodyMedium |
| **Card** | Body | bodyMedium |
| **Dialog** | Title | headlineSmall |
| **Dialog** | Body | bodyMedium |
| **Toast** | Message | bodyMedium |
| **Table** | Header | labelLarge |
| **Table** | Cell | bodyMedium |
| **Score** | Points | displaySmall |
| **Timer** | Time | displayMedium |
| **Badge** | Text | labelSmall |

---

## Technische Hinweise

### 1. Typography Token Definition

```typescript
// src/design-tokens/typography.ts

// Font Families
export const fontFamilies = {
  display: '"Bebas Neue", Impact, "Arial Black", sans-serif',
  heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const;

// Font Weights
export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// Font Sizes (in px für Klarheit, kann auch rem sein)
export const fontSizes = {
  // Display - für große Headlines, Scores
  displayLarge: '57px',
  displayMedium: '45px',
  displaySmall: '36px',

  // Headline - für Section-Überschriften
  headlineLarge: '32px',
  headlineMedium: '28px',
  headlineSmall: '24px',

  // Title - für Card-Titel, Listentitel
  titleLarge: '22px',
  titleMedium: '16px',
  titleSmall: '14px',

  // Body - für Fließtext
  bodyLarge: '16px',
  bodyMedium: '14px',
  bodySmall: '12px',

  // Label - für Buttons, Badges, Form-Labels
  labelLarge: '14px',
  labelMedium: '12px',
  labelSmall: '11px',
} as const;

// Line Heights (8pt Grid aligned where possible)
export const lineHeights = {
  displayLarge: '64px',   // 57 → 64 (8×8)
  displayMedium: '48px',  // 45 → 48 (8×6)
  displaySmall: '40px',   // 36 → 40 (8×5)

  headlineLarge: '40px',  // 32 → 40 (8×5)
  headlineMedium: '32px', // 28 → 32 (8×4)
  headlineSmall: '32px',  // 24 → 32 (8×4)

  titleLarge: '28px',     // 22 → 28
  titleMedium: '24px',    // 16 → 24 (8×3)
  titleSmall: '20px',     // 14 → 20

  bodyLarge: '24px',      // 16 → 24 (8×3)
  bodyMedium: '20px',     // 14 → 20
  bodySmall: '16px',      // 12 → 16 (8×2)

  labelLarge: '20px',     // 14 → 20
  labelMedium: '16px',    // 12 → 16 (8×2)
  labelSmall: '16px',     // 11 → 16 (8×2)
} as const;

// Letter Spacing (für Headlines etwas mehr)
export const letterSpacing = {
  tight: '-0.5px',
  normal: '0px',
  wide: '0.5px',
  wider: '1px',
} as const;

// Composite Typography Styles
export const typography = {
  // DISPLAY - Tournament Names, Scores
  displayLarge: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displayLarge,
    lineHeight: lineHeights.displayLarge,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.tight,
  },
  displayMedium: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displayMedium,
    lineHeight: lineHeights.displayMedium,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.tight,
  },
  displaySmall: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displaySmall,
    lineHeight: lineHeights.displaySmall,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.normal,
  },

  // HEADLINE - Section Headers
  headlineLarge: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.headlineLarge,
    lineHeight: lineHeights.headlineLarge,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },
  headlineMedium: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.headlineMedium,
    lineHeight: lineHeights.headlineMedium,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },
  headlineSmall: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.headlineSmall,
    lineHeight: lineHeights.headlineSmall,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },

  // TITLE - Card Titles, List Items
  titleLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleLarge,
    lineHeight: lineHeights.titleLarge,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  titleMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleMedium,
    lineHeight: lineHeights.titleMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  titleSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleSmall,
    lineHeight: lineHeights.titleSmall,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },

  // BODY - Text Content
  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLarge,
    lineHeight: lineHeights.bodyLarge,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.normal,
  },
  bodyMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyMedium,
    lineHeight: lineHeights.bodyMedium,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    lineHeight: lineHeights.bodySmall,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.normal,
  },

  // LABEL - Buttons, Badges, Form Labels
  labelLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelLarge,
    lineHeight: lineHeights.labelLarge,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelMedium,
    lineHeight: lineHeights.labelMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelSmall,
    lineHeight: lineHeights.labelSmall,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wider,
  },
} as const;

export type TypographyToken = keyof typeof typography;
```

### 2. Sport-Spezifische Typography

```typescript
// src/design-tokens/typography.ts (Ergänzung)

// Sport-spezifische Styles
export const sportTypography = {
  // Spielstand
  score: {
    fontFamily: fontFamilies.display,
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },

  // Timer / Uhrzeit
  timer: {
    fontFamily: fontFamilies.mono,
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'tabular-nums', // Gleichbreite Zahlen
  },

  // Team-Namen
  teamName: {
    ...typography.titleMedium,
    fontWeight: fontWeights.semibold,
  },

  // Turnier-Titel
  tournamentTitle: {
    ...typography.displayMedium,
    textTransform: 'uppercase' as const,
  },

  // Statistik-Werte
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: '28px',
    lineHeight: '32px',
    fontWeight: fontWeights.bold,
  },

  // Statistik-Labels
  statLabel: {
    ...typography.labelSmall,
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-secondary)',
  },
} as const;
```

### 3. CSS-Generierung

```typescript
// scripts/generateTypographyCss.ts

import { typography, fontFamilies } from '../src/design-tokens/typography';

function generateTypographyCss() {
  let css = '/* Auto-generated Typography CSS */\n\n';

  // Font-face for Bebas Neue (if self-hosted)
  css += `@font-face {
  font-family: 'Bebas Neue';
  src: url('/fonts/BebasNeue-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}\n\n`;

  // Typography utility classes
  Object.entries(typography).forEach(([name, styles]) => {
    const className = name.replace(/([A-Z])/g, '-$1').toLowerCase();
    css += `.text-${className} {\n`;
    css += `  font-family: ${styles.fontFamily};\n`;
    css += `  font-size: ${styles.fontSize};\n`;
    css += `  line-height: ${styles.lineHeight};\n`;
    css += `  font-weight: ${styles.fontWeight};\n`;
    if (styles.letterSpacing !== '0px') {
      css += `  letter-spacing: ${styles.letterSpacing};\n`;
    }
    css += `}\n\n`;
  });

  return css;
}
```

### 4. React-Komponente für Typography

```typescript
// src/components/ui/Text.tsx

import React from 'react';
import { typography, TypographyToken } from '../../design-tokens';

interface TextProps {
  variant?: TypographyToken;
  as?: keyof JSX.IntrinsicElements;
  color?: 'primary' | 'secondary' | 'tertiary' | 'inherit';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const colorMap = {
  primary: 'var(--color-text-primary)',
  secondary: 'var(--color-text-secondary)',
  tertiary: 'var(--color-text-tertiary)',
  inherit: 'inherit',
};

export const Text: React.FC<TextProps> = ({
  variant = 'bodyMedium',
  as: Component = 'span',
  color = 'primary',
  children,
  className,
  style,
}) => {
  const variantStyles = typography[variant];

  return (
    <Component
      className={className}
      style={{
        ...variantStyles,
        color: colorMap[color],
        ...style,
      }}
    >
      {children}
    </Component>
  );
};

// Beispielverwendung:
// <Text variant="headlineMedium" as="h2">Gruppe A</Text>
// <Text variant="bodySmall" color="secondary">Feld 1 • 10:30</Text>
```

### 5. Migration bestehender Komponenten

```diff
// src/components/ui/Button.tsx

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '8px 16px',
-   fontSize: theme.fontSizes.sm,  // 12px
+   ...typography.labelMedium,      // 12px + lineHeight + weight
  },
  md: {
    padding: '16px 24px',
-   fontSize: theme.fontSizes.md,  // 14px
+   ...typography.labelLarge,       // 14px + lineHeight + weight
  },
  lg: {
    padding: '24px 32px',
-   fontSize: theme.fontSizes.lg,  // 16px
+   ...typography.titleSmall,       // 14px, slightly different
  },
};
```

### 6. Font Loading Optimierung

```html
<!-- index.html -->
<head>
  <!-- Preconnect zu Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Font mit font-display: swap -->
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">

  <!-- Fallback für Offline -->
  <style>
    @font-face {
      font-family: 'Bebas Neue';
      src: local('Bebas Neue'), local('BebasNeue-Regular');
      font-display: swap;
    }
  </style>
</head>
```

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/design-tokens/typography.ts` | Neue umfassende Definition |
| `src/styles/theme.ts` | fontSizes deprecaten |
| `src/components/ui/Text.tsx` | Neue Komponente (optional) |
| `src/components/ui/Button.tsx` | Typography-Tokens verwenden |
| `src/components/ui/Input.tsx` | Typography-Tokens verwenden |
| `src/components/ui/Card.tsx` | Typography-Tokens verwenden |
| `*.module.css` | font-size durch Token ersetzen |
| `index.html` | Font-Loading optimieren |

---

## Definition of Done

- [ ] Typography-Tokens mit 15+ Styles definiert
- [ ] Composite Styles mit fontSize, lineHeight, fontWeight, letterSpacing
- [ ] Line-Heights auf 8pt Grid ausgerichtet (80%+)
- [ ] Sport-spezifische Styles (score, timer, teamName)
- [ ] Button-Komponente migriert
- [ ] Input-Komponente migriert
- [ ] Card-Komponenten migriert
- [ ] Font-Loading optimiert (font-display: swap)
- [ ] Dokumentation mit Komponenten-Mapping
- [ ] Visueller Review auf Mobile

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Font-Loading langsam | Niedrig | Mittel | font-display: swap, Preload |
| Zu viele Styles verwirrend | Niedrig | Niedrig | Klare Dokumentation + Mapping |
| Line-Heights ändern Layout | Mittel | Mittel | Schrittweise Migration |

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Abhängig von** | US-DESIGN-TOKENS |
| **Verwandt** | US-8PT-GRID |
| **Standards** | [Material Design 3 Typography](https://m3.material.io/styles/typography/overview) |

---

## Quellen

- [Material Design 3 Typography](https://m3.material.io/styles/typography/overview)
- [Android Material Design Font Guidelines 2024](https://www.learnui.design/blog/android-material-design-font-size-guidelines.html)
- [8-Point Grid Typography](https://www.freecodecamp.org/news/8-point-grid-typography-on-the-web-be5dc97db6bc/)
- [Web Font Loading Best Practices](https://web.dev/font-best-practices/)
