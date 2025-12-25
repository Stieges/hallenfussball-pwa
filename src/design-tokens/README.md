# Design Tokens

Single source of truth for all design values in the Hallenfussball PWA.

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

### Legacy: Theme Object

For backwards compatibility, the theme object is still available:

```typescript
import { theme } from '@/styles/theme';

// Legacy usage
const style = {
  color: theme.colors.primary,
  padding: theme.spacing.md,
};
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
├── index.ts        # Main export
├── colors.ts       # Color palette
├── spacing.ts      # 8pt spacing scale
├── typography.ts   # Font definitions
├── shadows.ts      # Elevation shadows
├── radii.ts        # Border radius
├── motion.ts       # Animations
├── breakpoints.ts  # Responsive
├── gradients.ts    # CSS gradients
└── README.md       # This file
```

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
