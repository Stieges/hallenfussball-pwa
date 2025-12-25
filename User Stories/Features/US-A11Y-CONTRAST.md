# US-A11Y-CONTRAST: WCAG-konforme Farbkontraste

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-A11Y-CONTRAST |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Accessibility / Design System |
| **Impact** | Hoch - Barrierefreiheit & Rechtskonformität |
| **Aufwand** | 4-6 Stunden |

---

## User Story

**Als** Nutzer mit eingeschränktem Sehvermögen oder in ungünstigen Lichtverhältnissen (Sporthalle)
**möchte ich** alle Texte und UI-Elemente klar erkennen können
**damit** ich die App sicher bedienen kann, ohne Inhalte zu übersehen

---

## Kontext

### Warum ist das wichtig?

1. **Rechtliche Anforderungen:** WCAG 2.2 ist in vielen Ländern gesetzlich vorgeschrieben (z.B. BITV 2.0 in Deutschland, European Accessibility Act ab 2025)

2. **Reale Nutzungssituation:** Sporthallen haben oft schlechte Beleuchtung, Nutzer schauen auf Bildschirme unter schwierigen Bedingungen

3. **Demografische Relevanz:** Ca. 8% der männlichen Bevölkerung hat eine Rot-Grün-Schwäche, viele ältere Trainer/Schiedsrichter haben altersbedingte Sehschwächen

4. **Aktueller Status:** Farbkontraste wurden bisher nicht systematisch validiert

### WCAG 2.2 Anforderungen

| Kriterium | Level | Anforderung |
|-----------|-------|-------------|
| 1.4.3 Contrast (Minimum) | AA | 4.5:1 für normalen Text, 3:1 für großen Text (≥18pt oder ≥14pt bold) |
| 1.4.6 Contrast (Enhanced) | AAA | 7:1 für normalen Text, 4.5:1 für großen Text |
| 1.4.11 Non-text Contrast | AA | 3:1 für UI-Komponenten und grafische Objekte |

### Aktuelle Farbpalette - Analyse

```
Hintergrund:     #0A1628 (sehr dunkel)
Surface:         #1E293B (dunkel)
Border:          #334155 (mittel-dunkel)

Text Primary:    #FFFFFF (weiß)      → auf #0A1628: ~15:1 ✓
Text Secondary:  #8BA3C7 (grau-blau) → auf #0A1628: ~5.2:1 ✓ (knapp)
                                      → auf #1E293B: ~3.8:1 ⚠️ (grenzwertig)

Primary:         #00E676 (grün)      → auf #0A1628: ~8.5:1 ✓
                                      → auf #FFFFFF: ~1.8:1 ✗ (kritisch!)

Secondary:       #00B0FF (blau)      → auf #0A1628: ~6.2:1 ✓

Error:           #FF5252 (rot)       → auf #0A1628: ~5.4:1 ✓
Warning:         #FF9100 (orange)    → auf #0A1628: ~6.8:1 ✓
```

### Identifizierte Probleme

| Problem | Wo | Kontrast | Erforderlich |
|---------|-----|----------|--------------|
| Text Secondary auf Surface | Cards, Dialoge | ~3.8:1 | 4.5:1 (AA) |
| Primary Text auf hellem Hintergrund | Invertierte Buttons | ~1.8:1 | 4.5:1 (AA) |
| Badge-Texte | Status-Badges | Variabel | 4.5:1 (AA) |
| Placeholder-Text | Inputs | Unklar | 4.5:1 (AA) |
| Disabled States | Buttons, Inputs | Unklar | Nicht erforderlich, aber Erkennbarkeit |

---

## Acceptance Criteria

### Basis-Funktionalität (WCAG AA)

1. **AC1 - Text Primary:** Given beliebiger primärer Text auf einem Hintergrund, When ich den Kontrast messe, Then beträgt er mindestens 4.5:1.

2. **AC2 - Text Secondary:** Given sekundärer/gedimmter Text auf einem Hintergrund, When ich den Kontrast messe, Then beträgt er mindestens 4.5:1.

3. **AC3 - UI-Komponenten:** Given ein Button, Input oder interaktives Element, When ich den Rand/Hintergrund gegen den umgebenden Hintergrund messe, Then beträgt der Kontrast mindestens 3:1.

4. **AC4 - Focus States:** Given ein fokussiertes Element, When ich den Focus-Ring gegen den Hintergrund messe, Then beträgt der Kontrast mindestens 3:1.

5. **AC5 - Error States:** Given eine Fehlermeldung oder Error-Markierung, When ich den Kontrast messe, Then beträgt er mindestens 4.5:1 für Text und 3:1 für visuelle Indikatoren.

6. **AC6 - Status-Farben:** Given Status-Badges (Live, Finished, Draft), When ich Text gegen Badge-Hintergrund messe, Then beträgt der Kontrast mindestens 4.5:1.

### Erweiterte Funktionalität

7. **AC7 - Dokumentation:** Given die finale Farbpalette, When ein Entwickler diese einsieht, Then findet er eine dokumentierte Kontrast-Matrix mit allen validierten Kombinationen.

8. **AC8 - Automatisierte Prüfung:** Given eine CI/CD-Pipeline, When ein neuer Build erstellt wird, Then werden Kontrastwerte automatisch geprüft (optional, nice-to-have).

9. **AC9 - Tooling:** Given ein Designer/Entwickler, When er eine Farbkombination wählt, Then hat er Zugang zu einem Kontrast-Checker (extern oder dokumentiert).

---

## UX-Hinweise

### Prinzipien

- **Kein Kontrast-Only Design:** Farbe niemals als einziges Unterscheidungsmerkmal nutzen (z.B. Icons + Farbe für Status)
- **Konsistenz:** Gleiche semantische Bedeutung = gleiche Farbkombination
- **Lesbarkeit vor Ästhetik:** Im Zweifel höheren Kontrast wählen

### Empfohlene Anpassungen

```css
/* VORHER - Text Secondary problematisch auf Surface */
--text-secondary: #8BA3C7;  /* ~3.8:1 auf Surface */

/* NACHHER - Angepasst für 4.5:1 */
--text-secondary: #A3B8D4;  /* ~5.1:1 auf Surface */
/* Alternativ: #9DB2CC für ~4.7:1 */
```

```css
/* Primary auf hellen Hintergründen - NICHT verwenden */
/* Stattdessen: Dunklere Variante für invertierten Kontext */
--primary-on-light: #00994D;  /* Dunkleres Grün, 4.5:1 auf Weiß */
```

### Visuelle Beispiele

```
┌─────────────────────────────────────────────────────────────┐
│  KONTRAST-BEISPIELE                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ GUT: Weiß auf #0A1628                                   │
│  ┌─────────────────────┐                                   │
│  │ █ Haupttext         │  15:1 - Exzellent                 │
│  └─────────────────────┘                                   │
│                                                             │
│  ⚠️ GRENZWERTIG: #8BA3C7 auf #1E293B                       │
│  ┌─────────────────────┐                                   │
│  │ █ Sekundärtext      │  3.8:1 - Unter AA                 │
│  └─────────────────────┘                                   │
│                                                             │
│  ✗ KRITISCH: #00E676 auf Weiß                              │
│  ┌─────────────────────┐                                   │
│  │ █ Grün auf Weiß     │  1.8:1 - Unzulässig              │
│  └─────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technische Hinweise

### 1. Kontrast-Validierung Tools

**Online Tools:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Goldstandard
- [Colour Contrast Analyser (CCA)](https://www.tpgi.com/color-contrast-checker/) - Desktop App
- [ButtonBuddy](https://buttonbuddy.dev/) - Speziell für Buttons

**Browser DevTools:**
- Chrome: Inspect Element → Styles → Color Swatch → Contrast Ratio anzeigen
- Firefox: Accessibility Inspector

**Automatisiert:**
- `axe-core` für automatisierte Tests
- `pa11y` für CI/CD Integration

### 2. Implementierungsschritte

```typescript
// 1. Neue Farbdefinitionen in global.css
:root {
  /* Angepasste Sekundärfarbe für besseren Kontrast */
  --text-secondary: #A3B8D4;  /* War: #8BA3C7 */

  /* Neue Variante für Primary auf hellen Flächen */
  --primary-on-light: #00994D;

  /* Dokumentierte Kombinationen */
  --contrast-text-on-bg: 15.0;      /* #FFFFFF auf #0A1628 */
  --contrast-secondary-on-bg: 6.2;  /* #A3B8D4 auf #0A1628 */
  --contrast-secondary-on-surface: 4.6;  /* #A3B8D4 auf #1E293B */
}
```

### 3. Kontrast-Matrix (zu erstellen)

```typescript
// src/docs/contrast-matrix.ts oder als Markdown
export const contrastMatrix = {
  textPrimary: {
    onBackground: { ratio: 15.0, passes: 'AAA' },
    onSurface: { ratio: 11.2, passes: 'AAA' },
  },
  textSecondary: {
    onBackground: { ratio: 6.2, passes: 'AA' },
    onSurface: { ratio: 4.6, passes: 'AA' },
  },
  primary: {
    onBackground: { ratio: 8.5, passes: 'AAA' },
    onWhite: { ratio: 1.8, passes: 'FAIL' },  // NICHT VERWENDEN
  },
  // ... weitere Kombinationen
};
```

### 4. Prüf-Checkliste

```markdown
## Kontrast-Validierung Checkliste

### Texte
- [ ] Body Text (#FFFFFF) auf Background (#0A1628): ≥4.5:1
- [ ] Body Text (#FFFFFF) auf Surface (#1E293B): ≥4.5:1
- [ ] Secondary Text auf Background: ≥4.5:1
- [ ] Secondary Text auf Surface: ≥4.5:1
- [ ] Placeholder Text auf Input Background: ≥4.5:1

### Buttons
- [ ] Primary Button Text auf Primary Background: ≥4.5:1
- [ ] Secondary Button Text auf Secondary Background: ≥4.5:1
- [ ] Ghost Button Text auf transparent: ≥4.5:1
- [ ] Danger Button Text auf Danger Background: ≥4.5:1
- [ ] Disabled Button erkennbar (nicht Kontrast-pflichtig)

### UI-Komponenten
- [ ] Input Border auf Background: ≥3:1
- [ ] Card Border auf Background: ≥3:1
- [ ] Focus Ring auf Background: ≥3:1
- [ ] Slider Track gegen Background: ≥3:1
- [ ] Slider Thumb gegen Track: ≥3:1

### Status-Farben
- [ ] Live Badge (Text auf Blau): ≥4.5:1
- [ ] Finished Badge (Text auf Grau): ≥4.5:1
- [ ] Draft Badge (Text auf Orange): ≥4.5:1
- [ ] Error Text/Icon: ≥4.5:1 / ≥3:1
- [ ] Warning Text/Icon: ≥4.5:1 / ≥3:1
- [ ] Success Text/Icon: ≥4.5:1 / ≥3:1

### Spezielle Komponenten
- [ ] Toast Text auf jeweiligem Gradient: ≥4.5:1
- [ ] Dialog Header Text: ≥4.5:1
- [ ] Table Header Text: ≥4.5:1
- [ ] Medal Colors (Gold/Silber/Bronze) erkennbar: ≥3:1
```

### 5. Test-Szenarien

```typescript
// Optional: Automatisierte Kontrast-Tests
import { getContrastRatio } from './utils/colorContrast';

describe('Color Contrast Compliance', () => {
  it('text-primary on background meets WCAG AA', () => {
    const ratio = getContrastRatio('#FFFFFF', '#0A1628');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('text-secondary on surface meets WCAG AA', () => {
    const ratio = getContrastRatio('#A3B8D4', '#1E293B');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('primary color on background meets WCAG AA', () => {
    const ratio = getContrastRatio('#00E676', '#0A1628');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
```

---

## Betroffene Dateien

| Datei | Änderungen |
|-------|------------|
| `src/styles/global.css` | CSS Variable `--text-secondary` anpassen |
| `src/styles/theme.ts` | Neue Farbvarianten hinzufügen |
| `src/components/ui/Button.tsx` | ggf. Text-Farbe auf Primary Button prüfen |
| `src/components/ui/Input.tsx` | Placeholder-Farbe prüfen |
| `src/components/ui/Toast/Toast.module.css` | Warning Toast (schwarzer Text) prüfen |
| `src/components/schedule/GroupTables.module.css` | Medal-Farben prüfen |
| Alle `.module.css` | Status-Badge-Texte prüfen |

---

## Definition of Done

- [ ] Alle Text-Kontraste erfüllen WCAG 2.2 AA (4.5:1)
- [ ] Alle UI-Komponenten erfüllen 3:1 Kontrast
- [ ] Kontrast-Matrix dokumentiert
- [ ] Manuelle Prüfung mit WebAIM Contrast Checker abgeschlossen
- [ ] Checkliste vollständig abgehakt
- [ ] Keine Regression in visueller Erscheinung (subjektive Prüfung)

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Visuelle Änderungen ungewollt | Mittel | Niedrig | Minimale Anpassungen, vorher Mockup |
| Übersehene Stellen | Mittel | Mittel | Systematische Checkliste |
| Automatisierte Tests false-positive | Niedrig | Niedrig | Manuelle Validierung |

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Konzeptdokument** | [DESIGN-SYSTEM-CONCEPT.md](../../docs/concepts/DESIGN-SYSTEM-CONCEPT.md) |
| **Ersetzt** | - |
| **Abhängig von** | - |
| **Verwandt** | US-DESIGN-TOKENS (sollte zuerst/parallel) |
| **Standards** | [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/), [WebAIM](https://webaim.org/resources/contrastchecker/) |

---

## Quellen

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.2 Understanding Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [Material Design Accessibility](https://m3.material.io/foundations/accessible-design/patterns)
- [ButtonBuddy - Accessible Buttons](https://buttonbuddy.dev/)
