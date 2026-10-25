# Design Tokens

Single source of truth for all design values in the Hallenfussball PWA.

---

## ⚠️ WICHTIG: Verbindliche Richtlinie

**Alle Styling-Werte MÜSSEN über Design Tokens definiert werden.**

```typescript
// ✅ RICHTIG
import { colors, spacing, fontSizes } from '../design-tokens';

// ❌ VERBOTEN - Keine hardcoded Werte!
padding: '16px'     // → spacing.md
color: '#00d46a'    // → colors.primary
fontSize: '14px'    // → fontSizes.md
```

**Bei Code-Reviews:** PRs mit hardcoded Styling-Werten werden abgelehnt.

---

## Overview

Design tokens are the visual design atoms of the design system - specifically, they are named entities that store visual design attributes. We use tokens in place of hard-coded values (such as hex values for color or pixel values for spacing) in order to maintain a scalable and consistent visual system.

## Token Categories

| Category | File | Description |
|----------|------|-------------|
| **Colors** | `colors.ts` | Semantic color palette with WCAG AA compliance |
| **Spacing** | `spacing.ts` | 8pt grid-based spacing scale |
| **Typography** | `typography.ts` | MD3-inspired type scale with 8pt line heights |
| **Shadows** | `shadows.ts` | Elevation shadows for dark theme |
| **Radii** | `radii.ts` | Border radius scale (8pt aligned) |
| **Motion** | `motion.ts` | Animation durations, easings, and transitions |
| **Breakpoints** | `breakpoints.ts` | Responsive breakpoints and media queries |
| **Gradients** | `gradients.ts` | CSS gradient definitions |

## Usage

### Recommended: Direct Import

```typescript
import { colors, spacing, typography } from '@/design-tokens';

// Use in styles
const style = {
  color: colors.primary,
  padding: spacing['2'], // 16px
  ...typography.bodyMedium,
};
```

### ⚠️ Veraltet: Theme Object

Das theme-Objekt existiert nur noch für Legacy-Kompatibilität.
**Nicht für neuen Code verwenden!**

```typescript
// ❌ VERALTET - Nicht mehr verwenden
import { theme } from '../styles/theme';
```

## Token Reference

### Colors

```typescript
// Brand
colors.primary      // #00E676 (green)
colors.secondary    // #00B0FF (blue)

// Text (WCAG AA validated)
colors.textPrimary  // #FFFFFF (15:1 contrast)
colors.textSecondary // #A3B8D4 (5.1:1 contrast)

// Status
colors.error        // #FF5252
colors.warning      // #FF9100
colors.success      // #4CAF50
```

#### Rand-Rollen: Bedien-Rand oder Trennlinie

| Rolle | Token | Wann | Kontrast |
|---|---|---|---|
| Bedien-Rand | `colors.borderControl` | Rand von Knopf, Eingabefeld, Auswahl, Chip, Schalter, Radio, Stepper, Farbwähler-Auslöser | mindestens 3 : 1 gegen die Fläche (WCAG 1.4.11, @OB-055, @OB-057) |
| Bedien-Rand auf erhöhter Fläche | `colors.borderControlRaised` | Bedienelement auf `surfaceLight` (im dunklen Thema heller als `borderControl`) | mindestens 3 : 1 gegen `surfaceLight` |
| Trennlinie / Kartenrand | `colors.border` (auch `borderDefault`, `borderMedium`, `borderSolid`, `borderSubtle`) | dekorativ: Karten, Kopf-/Fußlinien, Trenner, Tabellenlinien | bewusst unter 3 : 1 |
| Zustand | `colors.borderActive`, `primary`, `error` | gewählt, Fehler, live | eigene Farbe |

`borderLight` und `borderStrong` gibt es nicht mehr (B-51). Ein neuer Rand eines Bedienelements nimmt `borderControl`, nie `border`.
Die Prüfung `src/design-tokens/__tests__/borderControl.contrast.test.ts` rechnet beide Themen und den hohen Kontrast gegen die Flächen.

#### Tafel (Live-Cockpit)

Die Tafel (Spielstand, Uhr, Meldezeile) hat eigene Tokens, nie `surface`. Hell und dunkel: dunkle Tafel (Mockup-Freigabe 16.10.). Hoher Kontrast ist nicht MVP: schwarze Fläche, gelbe Zweitschrift, weißer Rand sind nur Platzhalter.

| Rolle | Token | Kontrast |
|---|---|---|
| Fläche | `colors.scoreboardBg` | deckend |
| Schrift / gedämpft (Zweitschrift) | `colors.scoreboardText` / `scoreboardTextMuted` | mindestens 4,5 : 1 |
| Live / Hervorhebung | `colors.scoreboardLive` / `scoreboardHighlight` | mindestens 3 : 1 |
| Schrift auf Live / auf Hervorhebung | `colors.scoreboardOnLive` / `scoreboardOnHighlight` | mindestens 4,5 : 1 |
| Schlussphase der Uhr (Violett #C4B5FD) | `colors.scoreboardFinalPhase` | mindestens 4,5 : 1, nie Live-Rot |
| Rand / Trennlinie | `colors.scoreboardBorder` / `scoreboardDivider` | Rand der Stand-Kästen |
| Meldezeile | `colors.noticeLineBg` (Fläche `scoreboardSurface`) / `noticeLineText` | mindestens 4,5 : 1 |
| Abzeichen | `colors.scoreboardOk`, `scoreboardInfo`, `scoreboardNeutral` | Füllung, Schrift über `scoreboardOnHighlight` oder Fläche |

**Regel:** Live-Rot (`scoreboardLive`, #DC2626) ist nur Fläche. Schrift darauf ist `scoreboardOnLive` (weiß, 4,83 : 1). Live-Rot als Schrift auf der Tafel ist verboten (hell nur 3,55 : 1).

Größen (`cssVars.sizing`, fest in px wie die Score-Regel): `scoreboardClockCompact` 32 px (Handy), `scoreboardClockRegular` 64 px (Tablet), `scoreboardClockWide` 56 px (ab 1024), `scoreboardScoreCompact` 40 px, `scoreboardScoreRegular` 64 px, `noticeLineHeightCompact` 24 px, `noticeLineHeightRegular` 32 px (reine Anzeige; nur das Kreuz hat 44 px). Prüfung: `src/design-tokens/__tests__/scoreboard-tokens.test.ts`.
Cockpit-Ziffern und Kästen (Plan Cockpit v2, @SL-178): `cockpitZifferHandy` 92 px, `cockpitZifferKnapp` 76 px, `cockpitZifferNormal` 80 px, `cockpitZifferGross` 88 px (Schriftgrößen; Ziffernhöhe ≈ 0,727 em, Handy ≥ 65 px, Laptop ≥ 55 px in jeder Stufe), `cockpitKastenHandy`/`Knapp`/`Normal`/`Gross` 96/76/90/108 px (Kastenhöhe). Stufen der Fensterhöhe: `cockpitHeightSteps` (`knapp` < 720, `gross` ≥ 800) und `cockpitMinHoehe` 620 in `breakpoints.ts`; CSS-Module nutzen `[data-stufe]`, keine Zahlen in Media-Queries. Prüfung: `__tests__/cockpitZiffern-tokens.test.ts` (inkl. Höhenbudget bei 620 px, Tor ≥ 56 px) und `visual:metrics` Regel `cockpit.ziffern`.
Cockpit Laptop, Maße je Stufe der Fensterhöhe (Plan Cockpit v2 B2, @SL-187): `cockpitTorKnapp`/`Normal`/`Gross` 60/72/84 px (Mindesthöhe der Tor-Taste, nie unter 56 px), `cockpitFussKnapp`/`Normal`/`Gross` 52/64/76 px (Foul-Reihe), `cockpitLeisteKnapp`/`Normal`/`Gross` 52/56/60 px (Fußleiste), `cockpitKopfKnapp`/`Normal`/`Gross` 40/44/48 px (Team-Leiste). Die Stufe „gross“ wächst ab 800 px linear mit der Fensterhöhe weiter (`--sizing-cockpit-{kasten,ziffer,fuss,kopf,leiste}-gross-fluid`, bei 1080 px 164/128/112/60/80 px wie im Mockup); Ereignisspalte: `--sizing-cockpit-ereignisspalte` 25rem in „knapp“, `--sizing-cockpit-ereignisspalte-gross` (`max(27.5rem, 31.25vw)`) sonst. Zeilenhöhe der Uhr in „knapp“: `--line-height-cockpit-uhr-knapp` 0,85. Die Hülle (`LiveCockpitShell.module.css`) setzt daraus `--cockpit-tor`, `--cockpit-fuss`, `--cockpit-kopf`, `--cockpit-kopf-schrift`, `--cockpit-strafe-ziffer`, `--cockpit-ereignisspalte` je `data-stufe`; Prüfung: `__tests__/cockpitStufen-tokens.test.ts`.

**Spielanzeige 2.3 (Daniel 19.10. „Tokens passen“):** `palette.kit` = Standardfarben und Voreinstellungen der Farbauswahl (`blue` #1565C0 Heim, `red` #C62828 Gast, `navy` #0D1B4C, `black` #000000; Gelb ist `palette.yellow[400]`, Weiß `palette.neutral[0]`, keine Duplikate). Nur `core/models` und Tests importieren sie direkt (`design-tokens/colors/palette`), Oberflächen nehmen Farben über die Ansicht. `cssVars.sizing.qrPlaceholder` 150 px (quadratischer QR-Platzhalter), `scorePreviewWidth` / `scorePreviewHeight` (2 × / 1,5 × `touchTargets.primary` = 112 × 84, Vorschau-Kästen), `cssVars.opacity.disabled` 0,5 (gesperrte Fläche). Prüfung: `src/design-tokens/__tests__/spielanzeige-tokens.test.ts`.

### Spacing (8pt Grid)

```typescript
spacing['0.5']  // 4px  (half unit)
spacing['1']    // 8px  (base)
spacing['2']    // 16px (standard)
spacing['3']    // 24px (section)
spacing['4']    // 32px (large)
spacing['6']    // 48px (huge)
```

### Typography

```typescript
// Composite styles (use spread)
typography.displayLarge   // Bebas Neue, 48px/56px
typography.headlineMedium // System, 20px/24px
typography.bodyMedium     // System, 14px/20px
typography.labelSmall     // System, 11px/16px

// Individual values
fontSizes.bodyMedium   // '14px'
lineHeights.bodyMedium // '20px'
fontWeights.medium     // 500
```

### Shadows

```typescript
shadows.sm   // Subtle (cards)
shadows.md   // Standard (dropdowns)
shadows.lg   // High (modals)

shadowSemantics.card    // = shadows.md
shadowSemantics.dialog  // High elevation
shadowSemantics.focus   // Focus ring
```

### Border Radius

```typescript
radii.sm   // 4px (badges)
radii.md   // 8px (buttons, inputs)
radii.lg   // 16px (cards, dialogs)
radii.full // 9999px (circles)
```

### Motion

```typescript
durations.fast    // 150ms
durations.normal  // 250ms
durations.slow    // 350ms

easings.standard  // MD3 standard curve
easings.decelerate // Enter animations
easings.accelerate // Exit animations

transitions.buttonPress // transform 100ms
transitions.fadeIn      // opacity 150ms
```

### Monitor-Folien (`displayMonitor`)

Feste Werte der Monitor-Folien (B-16d2), benannt nach Verwendung. Theme-abhängige Farben bleiben in `monitorThemes`.

```typescript
displayMonitor.overlay              // 'rgba(0, 0, 0, 0.7)' (Pause-Badge, Cache-Anzeige, theme-unabhängig)
displayMonitor.qr.foreground        // '#000000' (QR-Vordergrund, SVG-Attribut)
displayMonitor.qr.background        // '#ffffff' (QR-Hintergrund, SVG-Attribut)
displayMonitor.qr.sizeLarge         // 220 (QR-Folie)
displayMonitor.qr.sizeSmall         // 150 (Sponsor-Folie)
displayMonitor.overscan            // { defaultPercent: 5, minPercent: 0, maxPercent: 10, stepPercent: 0.5, urlParam: 'rand' } (Bildrand in % je Seite)
displayMonitor.radius.card          // '12px'
displayMonitor.marker.indicatorSize // '10px'
displayMonitor.size.*               // Logo-, Text-, Tabellen- und Spielplan-Maße
```

### Breakpoints

```typescript
breakpoints.mobile   // '480px'
breakpoints.tablet   // '768px'
breakpoints.desktop  // '1024px'

mediaQueries.mobile  // '@media (max-width: 480px)'
mediaQueries.desktop // '@media (min-width: 769px)'
```

## Design Principles

### 1. 8pt Grid System

All spacing, line heights, and border radii are based on an 8px grid:
- Use `spacing['1']` (8px) as the base unit
- Use `spacing['0.5']` (4px) only for fine-tuning
- Avoid arbitrary pixel values

### 2. WCAG AA Compliance

All text colors have been validated for accessibility:
- Normal text: ≥4.5:1 contrast ratio
- Large text (≥18pt): ≥3:1 contrast ratio
- UI components: ≥3:1 contrast ratio

### 3. Semantic Naming

Use semantic names that describe purpose, not appearance:
```typescript
// Good
colors.primary
colors.textSecondary
spacing.insetMd

// Avoid
colors.green
colors.gray
spacing['16px']
```

### 4. Single Source of Truth

All design values come from this directory. Never use:
- Hard-coded hex colors
- Magic number pixel values
- Inline duration/easing values

## File Structure

```
src/design-tokens/
├── index.ts           # Main export
├── colors/
│   ├── index.ts       # Color exports
│   ├── semantic.ts    # Dark theme (Source of Truth)
│   └── semantic-light.ts # Light theme
├── cssVars.ts         # CSS Variable mappings
├── spacing.ts         # 8pt spacing scale
├── typography.ts      # Font definitions
├── shadows.ts         # Elevation shadows
├── radii.ts           # Border radius
├── motion.ts          # Animations
├── breakpoints.ts     # Responsive
├── gradients.ts       # CSS gradients
├── __tests__/         # Token tests
│   ├── cssVars.test.ts
│   └── token-sync.test.ts # Sync verification
└── README.md          # This file
```

## Token Synchronization

### Multi-File Sync Architecture

Design tokens span multiple files that MUST stay in sync:

| File | Purpose | Sync Requirement |
|------|---------|------------------|
| `colors/semantic.ts` | Dark theme colors | Source of Truth |
| `colors/semantic-light.ts` | Light theme colors | Same properties as semantic.ts |
| `cssVars.ts` | CSS Variable mappings | All color properties mapped |
| `styles/global.css` | Runtime CSS Variables | `:root` and `[data-theme]` have all vars |

### Verification Commands

```bash
# Check token sync (also runs in CI and pre-commit)
npm run tokens:check

# Run sync tests
npm test -- --run src/design-tokens/__tests__/token-sync.test.ts
```

### Adding a New Color Token

1. Add to `colors/semantic.ts` (dark value)
2. Add to `colors/semantic-light.ts` (light value)
3. Add mapping to `cssVars.ts`: `myColor: 'var(--color-my-color)'`
4. Add to `global.css` `:root` block: `--color-my-color: #hexvalue;`
5. Add to `global.css` `[data-theme="light"]` block
6. Run `npm run tokens:check` to verify

### Naming Convention

| TypeScript (camelCase) | CSS Variable (kebab-case) |
|------------------------|---------------------------|
| `textPrimary` | `--color-text-primary` |
| `surfaceHover` | `--color-surface-hover` |
| `borderActive` | `--color-border-active` |

### Excluded Properties

Some properties are intentionally excluded from CSS Variable sync:
- `confettiColors` - Array type, not CSS compatible
- `backgroundGradientDark` - Full CSS gradient string
- `gradientNextMatch` - Full CSS gradient string

## Migration Guide

### From Hard-coded Values

```typescript
// Before
<div style={{ padding: '16px', color: '#00E676' }}>

// After
import { spacing, colors } from '@/design-tokens';
<div style={{ padding: spacing['2'], color: colors.primary }}>
```

### From theme.ts

```typescript
// Before
import { theme } from '@/styles/theme';
theme.colors.primary

// After
import { colors } from '@/design-tokens';
colors.primary
```

## Related Resources

- [Material Design 3](https://m3.material.io/)
- [WCAG 2.2 Contrast Guidelines](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [Design Tokens W3C Draft](https://tr.designtokens.org/format/)
