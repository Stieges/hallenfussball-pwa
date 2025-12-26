# Claude Code Conventions - Hallenfussball PWA

Diese Datei enthält wichtige Konventionen und Checklisten für die Arbeit an diesem Projekt.

---

## Pre-Change Checklist

**Vor JEDER Code-Änderung diese Schritte durchgehen:**

### 1. Dokumentation prüfen
- [ ] `/src/design-tokens/README.md` - Design Token Richtlinien
- [ ] `/docs/concepts/DESIGN-SYSTEM-CONCEPT.md` - Design System Architektur
- [ ] `CODE_INDEX.md` - Technische Referenz (wo ist was implementiert?)

### 2. Bestehende Patterns analysieren
- [ ] Wie wird das Problem in ähnlichen Komponenten gelöst?
- [ ] Gibt es bereits eine Utility/Helper dafür?
- [ ] Welche Design Tokens werden verwendet?

### 3. Auswirkungen bedenken
- [ ] Funktioniert die Lösung bei Theme-Wechsel (Dark/Light)?
- [ ] Ist die Lösung zukunftssicher oder ein Quick-Fix?
- [ ] Werden WCAG AA Kontrast-Anforderungen erfüllt?

---

## Styling Konventionen

### Design Tokens sind PFLICHT

```typescript
// ✅ RICHTIG
import { colors, spacing, fontSizes } from '@/design-tokens';

// ❌ VERBOTEN - Keine hardcoded Werte!
padding: '16px'     // → spacing.md
color: '#00d46a'    // → colors.primary
fontSize: '14px'    // → fontSizes.md
```

### Verfügbare Token-Kategorien

| Kategorie | Import | Beispiel |
|-----------|--------|----------|
| Farben | `colors` | `colors.primary`, `colors.textSecondary` |
| Abstände | `spacing` | `spacing.sm`, `spacing.md`, `spacing.lg` |
| Schrift | `fontSizes`, `fontWeights` | `fontSizes.md`, `fontWeights.bold` |
| Schatten | `shadows` | `shadows.md`, `shadows.lg` |
| Radien | `borderRadius` | `borderRadius.md`, `borderRadius.lg` |
| Animationen | `durations`, `easings` | `durations.fast`, `easings.standard` |

### Browser Native Controls (Date Picker, Scrollbars, etc.)

Für Browser-native Elemente wird `color-scheme` in `/src/styles/global.css` verwendet:

```css
:root {
  color-scheme: dark;  /* Browser rendert native Elemente im Dark Mode */
}
```

**NICHT verwenden:**
- `filter: invert(1)` - Bricht bei Theme-Wechsel
- Hardcoded Farben für native Elemente

---

## Häufige Fehler vermeiden

### 1. Isolierte Quick-Fixes
❌ Problem nur für einen Fall lösen
✅ Systemweite Lösung finden, die auch bei Theme-Wechsel funktioniert

### 2. Dokumentation ignorieren
❌ Direkt Code schreiben ohne Kontext
✅ Erst Design Token README und Design System Concept lesen

### 3. Hardcoded Werte
❌ `color: '#ffffff'`, `padding: '16px'`
✅ `color: colors.textPrimary`, `padding: spacing.md`

### 4. Vergessen von Theme-Kompatibilität
❌ Nur für Dark Mode entwickeln
✅ Corporate Colors und CSS Variables für Theme-Switching beachten

---

## Projektstruktur

```
src/
├── design-tokens/     # 🎨 Single Source of Truth für alle Styling-Werte
├── components/ui/     # Wiederverwendbare UI-Komponenten
├── styles/global.css  # Globale Styles, CSS Variables, color-scheme
└── features/          # Feature-spezifische Komponenten
```

---

## Code Quality

### Vor jedem Commit
```bash
npm run lint          # Muss ohne Warnings durchlaufen
npm run build         # Muss erfolgreich bauen
```

### Pre-Push Hook
- Automatische Lint + Build Prüfung
- `--max-warnings=0` ist aktiv

---

## Referenzen

- [Design Tokens README](src/design-tokens/README.md)
- [Design System Concept](docs/concepts/DESIGN-SYSTEM-CONCEPT.md)
- [CODE_INDEX.md](CODE_INDEX.md) - Technische Referenz
- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
