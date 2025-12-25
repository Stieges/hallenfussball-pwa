# US-CORPORATE-COLORS: Individuelle Farbschemata

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-CORPORATE-COLORS |
| **Priorität** | Low |
| **Status** | Draft |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Branding / Premium Feature |
| **Impact** | Mittel - Professionelles Erscheinungsbild, Wiedererkennungswert |
| **Monetarisierung** | Premium Feature (Pro-Abo) |
| **Konzeptdokument** | [DESIGN-SYSTEM-CONCEPT.md](../../docs/concepts/DESIGN-SYSTEM-CONCEPT.md) |

---

## User Story

**Als** Turnierveranstalter (Premium-User)
**möchte ich** meine Vereins- oder Unternehmensfarben für meine Turniere definieren können,
**damit** alle Turnierdokumente (App, PDF, Live-Anzeige) in meinen Corporate Colors erscheinen.

---

## Business Model: Premium Feature

### Monetarisierungs-Konzept

| Tier | Features | Preis |
|------|----------|-------|
| **Free** | Standard-Farbschema (Grün/Blau), bis zu 3 Turniere | Kostenlos |
| **Pro** | Corporate Colors, unbegrenzte Turniere, PDF-Export mit Logo | 9,99€/Monat |
| **Team** | Multi-User, Vereinsverwaltung, API-Zugang | 29,99€/Monat |

### User-Level vs. Tournament-Level

Corporate Colors werden **pro User** gespeichert (nicht pro Turnier):

```typescript
// Benutzerprofil enthält Corporate Colors
interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'team';
  corporateColors?: CorporateColors;  // ← Nur für Pro/Team
  // ...
}

// Beim Turnier-Erstellen: User-Farben werden angewendet
const tournament = createTournament({
  // ...
  branding: {
    colors: user.corporateColors || DEFAULT_COLORS,
  },
});
```

### Feature-Gating

```typescript
// src/utils/featureFlags.ts
export function canUseCorporateColors(user: User): boolean {
  return user.plan === 'pro' || user.plan === 'team';
}

// UI: Farbauswahl nur für Premium-User
{canUseCorporateColors(user) ? (
  <ColorPicker />
) : (
  <UpgradePrompt feature="Corporate Colors" />
)}
```

---

## Kontext

### Aktueller Stand

- **Farben sind hardcodiert** in `tailwind.config.js`:
  ```javascript
  colors: {
    primary: { DEFAULT: '#2563eb' },  // Blau - fest
    secondary: { DEFAULT: '#7c3aed' }, // Lila - fest
  }
  ```
- Keine Möglichkeit für Veranstalter, eigene Farben zu definieren
- PDF-Export nutzt ebenfalls feste Farben

### Use Cases

1. **Vereinsturnier**: Vereinsfarben (z.B. Rot-Weiß für FC Bayern)
2. **Firmen-Cup**: Corporate Identity des Unternehmens
3. **Stadtmeisterschaft**: Farben der Stadt/Gemeinde
4. **Verbandsturnier**: Verbandsfarben (z.B. DFB-Grün)

### Best Practices

Laut [Stack Team App](https://www.stackteamapp.com/) und [Jersey Watch](https://www.jerseywatch.com/):
- Primär- und Sekundärfarbe konfigurierbar
- Automatische Kontrastberechnung für Lesbarkeit
- Konsistente Anwendung über alle Kanäle

---

## Akzeptanzkriterien

### AC-1: Farbauswahl

- [ ] Color-Picker für Primärfarbe (Hauptfarbe)
- [ ] Color-Picker für Sekundärfarbe (Akzentfarbe)
- [ ] Optionale Textfarbe (Default: Auto-Kontrast)
- [ ] Hex-Code Eingabe möglich (#RRGGBB)
- [ ] Vorschau der Farbkombination

### AC-2: Farbvalidierung

- [ ] Kontrast-Check (WCAG AA Standard: 4.5:1 für Text)
- [ ] Warnung bei schlechtem Kontrast
- [ ] Automatische Korrektur-Vorschläge
- [ ] Lesbarkeits-Vorschau für verschiedene Schriftgrößen

### AC-3: Farbpresets

- [ ] Preset-Auswahl für häufige Farben:
  - Standard (Blau/Lila)
  - Vereinsfarben (Rot, Grün, Gelb, etc.)
  - DFB-Grün (#00A551)
  - Sportlich (verschiedene Kombinationen)
- [ ] Custom als letzte Option

### AC-4: App-Integration

- [ ] Farben werden als CSS-Variablen zur Laufzeit gesetzt
- [ ] Header, Buttons, Badges nutzen Primärfarbe
- [ ] Akzente, Highlights nutzen Sekundärfarbe
- [ ] Farben werden mit Turnier gespeichert

### AC-5: PDF-Integration

- [ ] PDF-Header in Primärfarbe
- [ ] Tabellen-Akzente in Sekundärfarbe
- [ ] Tabellenführer-Highlight in Primärfarbe
- [ ] Konsistente Darstellung wie in App

### AC-6: Live-Anzeige

- [ ] Monitor-Ansicht nutzt Corporate Colors
- [ ] Scoreboard in Primärfarbe
- [ ] Ergebnis-Badges in Sekundärfarbe

---

## UI-Konzept

### Farbauswahl im Wizard

```
┌─────────────────────────────────────────────────────────────┐
│ Erscheinungsbild                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Farbschema:                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ○ Standard (Blau)                                     │  │
│  │ ○ DFB-Grün                                           │  │
│  │ ○ Sportlich Rot                                       │  │
│  │ ● Benutzerdefiniert                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Benutzerdefiniert ─────────────────────────────────┐   │
│  │                                                      │   │
│  │  Primärfarbe:      [▓▓▓▓▓▓] [#E30613]               │   │
│  │                     ↑ Color-Picker                   │   │
│  │                                                      │   │
│  │  Sekundärfarbe:    [▓▓▓▓▓▓] [#FFFFFF]               │   │
│  │                                                      │   │
│  │  ⚠️ Kontrast zu gering - Text schwer lesbar          │   │
│  │     Vorschlag: #FFCC00 für besseren Kontrast        │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Vorschau ───────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ █████ STADTMEISTERSCHAFT 2025 ██████████████████│ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  [Primär-Button]  [Sekundär-Button]  Badge           │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Farbpresets

```
┌─────────────────────────────────────────────────────────────┐
│ Schnellauswahl - Farbschemata                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │████████│  │████████│  │████████│  │████████│            │
│  │████████│  │████████│  │████████│  │████████│            │
│  │ Blau   │  │ DFB    │  │ Rot    │  │ Gelb   │            │
│  └────────┘  └────────┘  └────────┘  └────────┘            │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │████████│  │████████│  │████████│  │████████│            │
│  │████████│  │████████│  │████████│  │████████│            │
│  │ Orange │  │ Lila   │  │ Türkis │  │ Custom │            │
│  └────────┘  └────────┘  └────────┘  └────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Datenmodell-Erweiterung

```typescript
// src/types/tournament.ts

interface TournamentColors {
  primary: string;      // Hex-Code, z.B. "#E30613"
  secondary: string;    // Hex-Code, z.B. "#FFFFFF"
  textOnPrimary?: string;   // Auto-berechnet oder manuell
  textOnSecondary?: string; // Auto-berechnet oder manuell
  preset?: 'standard' | 'dfb' | 'red' | 'yellow' | 'custom';
}

interface TournamentBranding {
  eventLogo?: string;
  sponsors?: SponsorLogo[];
  colors?: TournamentColors;  // NEU
}
```

### Farbpresets

```typescript
// src/constants/colorPresets.ts

export const COLOR_PRESETS: Record<string, TournamentColors> = {
  standard: {
    primary: '#2563eb',
    secondary: '#7c3aed',
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
  orange: {
    primary: '#EA580C',
    secondary: '#FFFFFF',
    preset: 'orange',
  },
  purple: {
    primary: '#7C3AED',
    secondary: '#FFFFFF',
    preset: 'purple',
  },
  teal: {
    primary: '#0D9488',
    secondary: '#FFFFFF',
    preset: 'teal',
  },
};
```

### Kontrast-Berechnung

```typescript
// src/utils/colorUtils.ts

/**
 * Berechnet relative Luminanz nach WCAG
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Berechnet Kontrastverhältnis (WCAG)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Bestimmt beste Textfarbe für Hintergrund
 */
export function getTextColor(bgColor: string): string {
  const whiteContrast = getContrastRatio(bgColor, '#FFFFFF');
  const blackContrast = getContrastRatio(bgColor, '#000000');
  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
}

/**
 * Prüft WCAG AA Compliance (4.5:1 für normalen Text)
 */
export function isWcagCompliant(bg: string, text: string): boolean {
  return getContrastRatio(bg, text) >= 4.5;
}
```

### CSS-Variablen-Injektion

```typescript
// src/utils/themeManager.ts

export function applyTournamentColors(colors: TournamentColors): void {
  const root = document.documentElement;

  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty(
    '--color-text-on-primary',
    colors.textOnPrimary || getTextColor(colors.primary)
  );
  root.style.setProperty(
    '--color-text-on-secondary',
    colors.textOnSecondary || getTextColor(colors.secondary)
  );

  // HSL-Varianten für Hover-States
  const hsl = hexToHsl(colors.primary);
  root.style.setProperty('--color-primary-light', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l + 10}%)`);
  root.style.setProperty('--color-primary-dark', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l - 10}%)`);
}

export function resetToDefaultColors(): void {
  applyTournamentColors(COLOR_PRESETS.standard);
}
```

### Tailwind CSS-Integration

```css
/* src/styles/theme.css */

:root {
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
  --color-text-on-primary: #ffffff;
  --color-text-on-secondary: #ffffff;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.badge-accent {
  background-color: var(--color-secondary);
  color: var(--color-text-on-secondary);
}

.header-branded {
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
}
```

### PDF-Integration

```typescript
// src/lib/pdfExporter.ts

function getPdfColors(branding?: TournamentBranding): PdfColors {
  const colors = branding?.colors || COLOR_PRESETS.standard;

  return {
    headerBg: colors.primary,
    headerText: getTextColor(colors.primary),
    accentBg: colors.secondary,
    accentText: getTextColor(colors.secondary),
    tableBorder: colors.primary,
    highlight: colors.primary,
  };
}

function renderPdfHeader(doc: jsPDF, colors: PdfColors, title: string) {
  doc.setFillColor(colors.headerBg);
  doc.rect(0, 0, 210, 25, 'F');

  doc.setTextColor(colors.headerText);
  doc.setFontSize(18);
  doc.text(title, 105, 15, { align: 'center' });
}
```

---

## Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/tournament.ts` | TournamentColors Interface |
| `src/constants/colorPresets.ts` | NEU: Farbpresets |
| `src/utils/colorUtils.ts` | NEU: Kontrast-Berechnung |
| `src/utils/themeManager.ts` | NEU: CSS-Variable-Injektion |
| `src/styles/theme.css` | CSS-Variablen statt Tailwind-Farben |
| `src/screens/TournamentCreationScreen.tsx` | Farbauswahl-Sektion |
| `src/lib/pdfExporter.ts` | Dynamische Farben |
| `src/App.tsx` | Theme-Initialisierung |
| `tailwind.config.js` | CSS-Variablen-Referenzen |

---

## Implementierungsphasen

### Phase 1: Datenmodell & Utilities (2h)
- [ ] TournamentColors Interface
- [ ] COLOR_PRESETS Konstanten
- [ ] colorUtils (Kontrast, Luminanz)

### Phase 2: Theme-Manager (2h)
- [ ] CSS-Variablen-System
- [ ] applyTournamentColors Funktion
- [ ] Integration in App.tsx

### Phase 3: UI-Komponenten (2h)
- [ ] ColorPicker Komponente
- [ ] ColorPresetSelector
- [ ] Kontrast-Warnung
- [ ] Vorschau-Komponente

### Phase 4: Wizard-Integration (1h)
- [ ] Sektion in Stammdaten oder eigenem Step
- [ ] Preset-Auswahl
- [ ] Custom-Farben

### Phase 5: PDF & Live (1.5h)
- [ ] PDF-Exporter mit dynamischen Farben
- [ ] Live-Anzeige mit Corporate Colors
- [ ] Monitor-Ansicht

---

## Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Schlechte Lesbarkeit | Hoch | WCAG-Kontrast-Check, Warnungen |
| Performance (CSS-Injection) | Niedrig | Einmalige Anwendung beim Laden |
| Inkonsistenz App/PDF | Mittel | Zentrale Farb-Definition nutzen |
| Browser-Kompatibilität | Niedrig | CSS-Variablen sind gut unterstützt |

---

## Abgrenzung

**In Scope:**
- Primär- und Sekundärfarbe
- Farbpresets
- Kontrast-Validierung
- App-, PDF- und Live-Integration

**Out of Scope:**
- Dark Mode (→ Future)
- Font-Auswahl
- Komplette Theme-Editoren
- Animierte Farbübergänge

---

## Verwandte User Stories

- **US-LOGO-INTEGRATION**: Logos + Farben = vollständiges Branding
- **US-TEAM-LOGOS**: Team-Farben für Initialen-Badges
- **US-PDF-FORMATS**: Farben in verschiedenen Formaten
