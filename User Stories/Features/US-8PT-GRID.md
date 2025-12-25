# US-8PT-GRID: Konsistentes 8-Punkt Spacing Grid

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-8PT-GRID |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Design System |
| **Impact** | Hoch - Visuelle Konsistenz |
| **Aufwand** | 4-6 Stunden |

---

## User Story

**Als** Nutzer der App
**möchte ich** eine visuell harmonische und konsistente Benutzeroberfläche erleben
**damit** die App professionell wirkt und ich mich intuitiv zurechtfinde

---

## Kontext

### Was ist das 8-Punkt Grid?

Das 8-Punkt Grid System ist ein Designprinzip, bei dem alle Abstände, Größen und Layouts auf Vielfachen von 8 Pixeln basieren:

```
8, 16, 24, 32, 40, 48, 56, 64, 72, 80...
```

**Vorteile:**
- **Konsistenz:** Einheitlicher visueller Rhythmus
- **Skalierbarkeit:** 8 ist durch 2 und 4 teilbar → skaliert gut auf allen Displays
- **Einfachheit:** Weniger Entscheidungen, schnellere Entwicklung
- **Kompatibilität:** Die meisten Bildschirmauflösungen sind durch 8 teilbar

### Aktueller Zustand

```typescript
// src/styles/theme.ts - AKTUELL
spacing: {
  xs: '4px',    // ✓ 8 ÷ 2 = OK (Halb-Einheit)
  sm: '8px',    // ✓ 8 × 1 = OK
  md: '12px',   // ✗ NICHT im 8pt Grid!
  lg: '16px',   // ✓ 8 × 2 = OK
  xl: '24px',   // ✓ 8 × 3 = OK
  xxl: '32px',  // ✓ 8 × 4 = OK
}
```

**Problem:** `md: 12px` bricht das 8pt Grid und führt zu inkonsistenten Layouts.

### Wo wird 12px verwendet?

```
src/styles/theme.ts:      md: '12px'
src/components/ui/Button.tsx:  padding: '12px 16px' (via md lg)
src/components/ui/Input.tsx:   padding: '12px 16px'
*.module.css:             padding: 12px (verschiedene Stellen)
```

### Best Practice 2024

| Quelle | Empfehlung |
|--------|------------|
| Material Design 3 | 4px Baseline, 8px für größere Abstände |
| Apple HIG | 8pt Grid für iOS |
| IBM Carbon | 8px / 16px Mini-Einheiten |
| Tailwind CSS | 4px Basis (0.25rem), empfiehlt 8px für Konsistenz |

---

## Acceptance Criteria

### Basis-Funktionalität

1. **AC1 - Spacing Scale:** Given das Spacing-System, When ich die definierten Werte prüfe, Then sind alle Werte Vielfache von 8px (mit Ausnahme von 4px als Halb-Einheit).

2. **AC2 - Keine 12px:** Given die Codebasis, When ich nach "12px" oder "12 px" oder "0.75rem" suche, Then finde ich maximal 5 begründete Ausnahmen.

3. **AC3 - Komponenten-Padding:** Given alle UI-Komponenten (Button, Input, Card, etc.), When ich deren Padding prüfe, Then folgt es dem 8pt Grid.

4. **AC4 - Gap-Properties:** Given CSS Grid oder Flexbox Layouts, When ich die gap-Werte prüfe, Then sind alle Werte 8pt-konform.

5. **AC5 - Margin-Konsistenz:** Given Margins zwischen Sections, When ich die Werte prüfe, Then sind alle Werte 8pt-konform.

### Erweiterte Funktionalität

6. **AC6 - Border-Radius Integration:** Given Border-Radius-Werte, Then folgen auch diese dem 8pt Grid (4px, 8px, 16px, 24px).

7. **AC7 - Line-Height Alignment:** Given Typografie Line-Heights, Then sind diese möglichst auf 8pt ausgerichtet (16px, 24px, 32px, etc.).

8. **AC8 - Icon Sizing:** Given Icon-Größen, Then sind diese 8pt-konform (16px, 24px, 32px).

9. **AC9 - Touch Targets:** Given Touch-Targets, Then sind diese mindestens 40px (5×8) oder idealerweise 48px (6×8), nicht 44px.

---

## UX-Hinweise

### Visueller Unterschied

```
┌─────────────────────────────────────────────────────────────┐
│  VORHER (inkonsistent)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │ Card (padding: 24px)                 │                  │
│  │                                       │                  │
│  │  ┌────────────────┐ ← 12px gap       │                  │
│  │  │ Button         │                  │                  │
│  │  └────────────────┘                  │                  │
│  │        ↑                              │                  │
│  │     12px (unruhig)                    │                  │
│  │                                       │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  NACHHER (8pt Grid)                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │ Card (padding: 24px)                 │                  │
│  │                                       │                  │
│  │  ┌────────────────┐ ← 16px gap       │                  │
│  │  │ Button         │   (8×2)          │                  │
│  │  └────────────────┘                  │                  │
│  │        ↑                              │                  │
│  │     16px (harmonisch)                 │                  │
│  │                                       │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Wann 4px statt 8px?

4px (Halb-Einheit) ist erlaubt für:
- Icon-zu-Text Abstände
- Feintuning bei sehr kompakten Elementen
- Badge-Innenabstände
- Zwischen eng zusammengehörigen Elementen

```
✓ Icon ←4px→ "Button Text"
✓ Badge mit 4px padding
✗ Section-Abstände mit 4px (zu klein)
```

---

## Technische Hinweise

### 1. Neue Spacing Scale

```typescript
// src/design-tokens/spacing.ts

export const spacing = {
  // Basis-Einheiten
  '0': '0',
  '0.5': '4px',   // Halb-Einheit (8 ÷ 2)
  '1': '8px',     // 8 × 1
  '2': '16px',    // 8 × 2 (ersetzt altes md: 12px)
  '3': '24px',    // 8 × 3
  '4': '32px',    // 8 × 4
  '5': '40px',    // 8 × 5
  '6': '48px',    // 8 × 6
  '8': '64px',    // 8 × 8
  '10': '80px',   // 8 × 10
  '12': '96px',   // 8 × 12
} as const;

// Semantische Aliases
export const spacingSemantics = {
  // Komponenten-Innenabstände
  buttonPaddingSm: `${spacing['1']} ${spacing['2']}`,     // 8px 16px
  buttonPaddingMd: `${spacing['2']} ${spacing['3']}`,     // 16px 24px (NEU!)
  buttonPaddingLg: `${spacing['3']} ${spacing['4']}`,     // 24px 32px

  inputPadding: `${spacing['2']} ${spacing['2']}`,        // 16px 16px (war 12px 16px)

  cardPadding: spacing['3'],                               // 24px

  // Abstände zwischen Elementen
  formGap: spacing['2'],                                   // 16px
  sectionGap: spacing['4'],                                // 32px
  stackGap: spacing['1'],                                  // 8px
};
```

### 2. Migration: 12px → 16px

```typescript
// Button.tsx - VORHER
const sizeStyles = {
  sm: { padding: '8px 12px' },    // ✗
  md: { padding: '12px 16px' },   // ✗
  lg: { padding: '16px 24px' },   // ✓
};

// Button.tsx - NACHHER
const sizeStyles = {
  sm: { padding: '8px 16px' },    // ✓ (1, 2)
  md: { padding: '16px 24px' },   // ✓ (2, 3)
  lg: { padding: '24px 32px' },   // ✓ (3, 4)
};
```

```typescript
// Input.tsx - VORHER
padding: '12px 16px',

// Input.tsx - NACHHER
padding: '16px 16px',  // Oder '16px' für alle Seiten
```

### 3. Such-Pattern für Migration

```bash
# Finde alle 12px Verwendungen
grep -rn "12px\|12 px\|0\.75rem" src/ --include="*.tsx" --include="*.ts" --include="*.css"

# Finde alle nicht-8pt Werte (komplexer)
grep -rn "[0-9]\+px" src/ | grep -v "8px\|16px\|24px\|32px\|40px\|48px\|4px\|0px"
```

### 4. CSS Module Migration

```css
/* VORHER - Step2_ModeAndSystem.module.css */
.modeOption {
  padding: 12px;
  gap: 12px;
}

/* NACHHER */
.modeOption {
  padding: var(--spacing-2);  /* 16px */
  gap: var(--spacing-2);      /* 16px */
}
```

### 5. Border-Radius Anpassung

```typescript
// VORHER
borderRadius: {
  sm: '4px',   // ✓
  md: '8px',   // ✓
  lg: '12px',  // ✗ Nicht im 8pt Grid
  xl: '16px',  // ✓
}

// NACHHER
borderRadius: {
  sm: '4px',   // ✓ (halb)
  md: '8px',   // ✓ (1×)
  lg: '16px',  // ✓ (2×) - angepasst!
  xl: '24px',  // ✓ (3×)
}
```

### 6. Touch Target Überlegung

```typescript
// WCAG empfiehlt 44px, aber 48px passt besser ins 8pt Grid
const touchTarget = {
  minimum: '44px',       // WCAG AAA
  preferred: '48px',     // 8pt Grid aligned (6 × 8)
};

// Empfehlung: 48px für primäre Touch-Targets verwenden
```

### 7. Checkliste für Entwickler

```markdown
## 8pt Grid Checkliste

Vor jedem Commit prüfen:

### Spacing
- [ ] Alle padding-Werte sind 4, 8, 16, 24, 32, 40, 48px
- [ ] Alle margin-Werte sind 4, 8, 16, 24, 32, 40, 48px
- [ ] Alle gap-Werte sind 4, 8, 16, 24, 32, 40, 48px

### Sizing
- [ ] Icon-Größen: 16, 24, 32, 48px
- [ ] Touch-Targets: mindestens 40px, idealerweise 48px
- [ ] Min-Heights/Widths: Vielfache von 8

### Typography
- [ ] Line-Heights: 16, 20, 24, 28, 32, 36, 40px (oder nah dran)

### Layout
- [ ] Container max-widths: Vielfache von 8
- [ ] Grid Gutters: 8, 16, 24, 32px

### Ausnahmen (mit Kommentar!)
- 1px für Borders (physisch notwendig)
- 44px für WCAG Touch Targets (wenn 48px zu groß)
- Schriftgrößen (folgen eigenem System)
```

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/styles/theme.ts` | `md: '12px'` → entfernen |
| `src/design-tokens/spacing.ts` | Neue Scale definieren |
| `src/components/ui/Button.tsx` | Padding anpassen |
| `src/components/ui/Input.tsx` | Padding anpassen |
| `src/components/ui/Select.tsx` | Padding anpassen |
| `src/components/ui/NumberStepper.tsx` | Prüfen |
| `*.module.css` (alle) | 12px → 16px |
| `src/design-tokens/radii.ts` | lg: 12px → 16px |

---

## Beispiel-Änderungen

### Button Component

```diff
// src/components/ui/Button.tsx

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
-   padding: '8px 12px',
+   padding: '8px 16px',
    fontSize: theme.fontSizes.sm,
  },
  md: {
-   padding: '12px 16px',
+   padding: '16px 24px',
    fontSize: theme.fontSizes.md,
  },
  lg: {
    padding: '16px 24px',
    fontSize: theme.fontSizes.lg,
  },
};
```

### Input Component

```diff
// src/components/ui/Input.tsx

const inputStyles: React.CSSProperties = {
- padding: '12px 16px',
+ padding: '16px 16px',
  // ...
};
```

### Module CSS

```diff
/* src/features/tournament-creation/Step2_ModeAndSystem.module.css */

.modeOption {
- padding: 12px;
+ padding: 16px;
- gap: 12px;
+ gap: 16px;
}
```

---

## Definition of Done

- [ ] Spacing Scale enthält nur 8pt-konforme Werte
- [ ] Alle `12px` Vorkommen ersetzt oder begründet
- [ ] Button, Input, Select Padding angepasst
- [ ] Border-Radius lg auf 16px geändert
- [ ] Alle .module.css Dateien geprüft
- [ ] Visueller Review: Layout sieht harmonisch aus
- [ ] Keine TypeScript-Fehler
- [ ] Manuelle Tests auf Mobile und Desktop

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Visuelle Änderungen zu stark | Mittel | Mittel | 12px → 16px ist subtil, kaum merkbar |
| Vergessene Stellen | Mittel | Niedrig | grep-basierte Suche |
| Layouts brechen | Niedrig | Mittel | Schrittweise Migration mit Tests |

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Abhängig von** | US-DESIGN-TOKENS (empfohlen parallel) |
| **Blockiert** | - |
| **Verwandt** | US-TYPOGRAPHY-SCALE |

---

## Quellen

- [The Comprehensive 8pt Grid Guide](https://medium.com/swlh/the-comprehensive-8pt-grid-guide-aa16ff402179)
- [8-Point Grid: Typography on the Web](https://www.freecodecamp.org/news/8-point-grid-typography-on-the-web-be5dc97db6bc/)
- [Spacing Best Practices](https://cieden.com/book/sub-atomic/spacing/spacing-best-practices)
- [Material Design Layout](https://m3.material.io/foundations/layout/understanding-layout)
