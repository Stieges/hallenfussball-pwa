# US-PDF-FORMATS: PDF Format-Optionen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-PDF-FORMATS |
| **Priorität** | Medium |
| **Status** | Draft |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | PDF-Export |
| **Impact** | Hoch - Professionelle Turnierpläne für verschiedene Anwendungsfälle |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** den Spielplan in verschiedenen Formaten (A4, A3, A2) und Orientierungen exportieren können,
**damit** ich professionelle Aushänge für die Sporthalle erstellen und den Spielplan optimal präsentieren kann.

---

## Kontext

### Aktuelle Einschränkung

Der PDF-Export ist derzeit auf A4-Portrait festgelegt:

```typescript
// src/lib/pdfExporter.ts
const doc = new jsPDF({
  orientation: 'portrait',
  format: 'a4',  // Nur A4 unterstützt
});
```

### Use Cases

1. **A3 Hallenaushang**: Großer, gut lesbarer Spielplan zum Aufhängen in der Sporthalle
2. **A4 Handout**: Kompakte Version für Trainer und Teams
3. **A2 Poster**: Maximale Sichtbarkeit für große Hallen
4. **Landscape für viele Felder**: Bei 3+ Feldern ist Querformat übersichtlicher

### Professionelle Anforderungen

Profi-Veranstalter erwarten:
- Skalierbare Schriftgrößen je nach Format
- Optimale Nutzung des verfügbaren Platzes
- Druckfertige Qualität ohne manuelle Nacharbeit

---

## Akzeptanzkriterien

### AC-1: Format-Auswahl

- [ ] Dropdown für Papierformat: A4, A3, A2
- [ ] Toggle für Orientierung: Portrait / Landscape
- [ ] Vorschau passt sich der Auswahl an
- [ ] Default: A4 Portrait (wie bisher)

### AC-2: Automatische Skalierung

- [ ] Schriftgrößen skalieren proportional zum Format
- [ ] Tabellen-Spaltenbreiten passen sich an
- [ ] Abstände und Margins skalieren mit
- [ ] Logo und QR-Code skalieren proportional

### AC-3: Format-Presets

- [ ] "Handout" → A4 Portrait, kompakte Schrift
- [ ] "Hallenaushang" → A3 Landscape, große Schrift
- [ ] "Poster" → A2 Portrait, extra große Schrift
- [ ] "Benutzerdefiniert" → Freie Kombination

### AC-4: Intelligente Layout-Empfehlung

- [ ] Bei 3+ Feldern: Empfehlung für Landscape
- [ ] Bei vielen Teams: Empfehlung für größeres Format
- [ ] Bei langen Teamnamen: Warnung bei zu kleinem Format

### AC-5: Druckqualität

- [ ] PDF-Auflösung angepasst für Großformate
- [ ] Vektorgrafiken wo möglich (skalierbar)
- [ ] Schriften eingebettet für konsistente Darstellung

---

## UI-Konzept

### Export-Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ PDF Export                                              ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Format-Vorlage:                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ○ Handout (A4 Portrait)                              │  │
│  │ ● Hallenaushang (A3 Landscape) ← Empfohlen           │  │
│  │ ○ Poster (A2 Portrait)                               │  │
│  │ ○ Benutzerdefiniert                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Benutzerdefiniert ─────────────────────────────────┐   │
│  │                                                      │   │
│  │  Papierformat:    [A4 ▼]  [A3]  [A2]                │   │
│  │                                                      │   │
│  │  Orientierung:    [Portrait ▼]  [Landscape]          │   │
│  │                                                      │   │
│  │  Schriftgröße:    [Normal ▼]  [Groß]  [Extra Groß]  │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────┐               │
│  │                                         │               │
│  │           [Vorschau]                    │               │
│  │                                         │               │
│  │    Format: A3 Landscape                 │               │
│  │    Größe: 420 × 297 mm                  │               │
│  │                                         │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│                              [Abbrechen]  [PDF erstellen]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Konfigurationsstruktur

```typescript
// src/types/pdfExport.ts

export type PaperFormat = 'a4' | 'a3' | 'a2';
export type Orientation = 'portrait' | 'landscape';
export type FontScale = 'normal' | 'large' | 'extra-large';

export interface PdfExportConfig {
  format: PaperFormat;
  orientation: Orientation;
  fontScale: FontScale;
  preset?: 'handout' | 'hallenaushang' | 'poster' | 'custom';
}

export const PDF_PRESETS: Record<string, PdfExportConfig> = {
  handout: {
    format: 'a4',
    orientation: 'portrait',
    fontScale: 'normal',
    preset: 'handout',
  },
  hallenaushang: {
    format: 'a3',
    orientation: 'landscape',
    fontScale: 'large',
    preset: 'hallenaushang',
  },
  poster: {
    format: 'a2',
    orientation: 'portrait',
    fontScale: 'extra-large',
    preset: 'poster',
  },
};
```

### Skalierungsfaktoren

```typescript
// src/lib/pdfExporter.ts

const FORMAT_SCALE: Record<PaperFormat, number> = {
  a4: 1.0,
  a3: 1.414,  // √2 (A3 ist √2 × A4)
  a2: 2.0,    // 2 × A4
};

const FONT_SCALE: Record<FontScale, number> = {
  normal: 1.0,
  large: 1.25,
  'extra-large': 1.5,
};

function getScaledStyle(config: PdfExportConfig): PdfStyle {
  const formatScale = FORMAT_SCALE[config.format];
  const fontScale = FONT_SCALE[config.fontScale];
  const totalScale = formatScale * fontScale;

  return {
    fontSize: {
      title: Math.round(24 * totalScale),
      heading: Math.round(14 * totalScale),
      body: Math.round(11 * totalScale),
      small: Math.round(9 * totalScale),
    },
    spacing: {
      section: Math.round(20 * formatScale),
      row: Math.round(8 * formatScale),
    },
    // ...
  };
}
```

### Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/pdfExporter.ts` | Format-Parameter, Skalierung |
| `src/types/pdfExport.ts` | NEU: Typen für Export-Konfiguration |
| `src/features/pdf-export/PdfExportDialog.tsx` | NEU: Export-Dialog mit Optionen |
| `src/components/schedule/ScheduleDisplay.tsx` | Export-Button öffnet Dialog |
| `src/features/tournament-management/ScheduleTab.tsx` | Export-Dialog integrieren |

---

## Implementierungsphasen

### Phase 1: Typen & Konfiguration (1h)
- [ ] PdfExportConfig Interface
- [ ] PDF_PRESETS Konstanten
- [ ] Skalierungsfaktoren

### Phase 2: PDF-Generator erweitern (2h)
- [ ] Format-Parameter in jsPDF
- [ ] Dynamische Style-Berechnung
- [ ] Skalierte Fonts und Abstände

### Phase 3: Export-Dialog (2h)
- [ ] PdfExportDialog Komponente
- [ ] Preset-Auswahl
- [ ] Benutzerdefinierte Optionen
- [ ] Vorschau (optional)

### Phase 4: Integration (1h)
- [ ] Dialog in ScheduleTab einbinden
- [ ] Bestehenden Export-Button anpassen
- [ ] Tests

---

## Abgrenzung

**In Scope:**
- Papierformat-Auswahl (A4, A3, A2)
- Orientierung (Portrait/Landscape)
- Schriftgrößen-Skalierung
- Format-Presets

**Out of Scope:**
- Farbschema-Anpassung (→ US-PDF-BRANDING)
- Logo-Upload (→ bereits in Turnier-Stammdaten)
- Mehrere Seiten-Layouts (→ Future)
- Export als Bild (PNG/JPG) (→ Future)

---

## Verwandte User Stories

- **US-GROUPS-AND-FIELDS**: Custom Namen erscheinen im PDF
- **US-FINALS-NAMING**: Finalrunden-Bezeichnungen im PDF
- **US-PDF-BRANDING** (Future): Vereinsfarben und Branding im PDF
