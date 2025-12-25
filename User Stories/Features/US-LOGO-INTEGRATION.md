# US-LOGO-INTEGRATION: Event- und Sponsor-Logos

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-LOGO-INTEGRATION |
| **Priorität** | High |
| **Status** | Draft |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Branding |
| **Impact** | Sehr Hoch - Professionelles Erscheinungsbild für Veranstalter |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** ein Veranstaltungs-Logo und Sponsor-Logos hochladen können,
**damit** meine Turnierdokumente (Spielpläne, PDFs, Live-Anzeige) professionell gebrandet sind und Sponsoren sichtbar präsentiert werden.

---

## Kontext

### Aktueller Stand

- **Keine Logo-Unterstützung** im gesamten System
- Weder Datenstruktur noch UI noch PDF-Rendering vorhanden
- Professionelle Turnierveranstalter erwarten Corporate Branding

### Use Cases

1. **Vereinsturnier**: Vereinslogo auf allen Dokumenten
2. **Stadtmeisterschaft**: Stadt-Logo + Sponsor-Logos
3. **Firmen-Cup**: Firmenlogo prominent, Partner-Logos im Footer
4. **Jugend-Turnier**: Verband-Logo + lokale Sponsoren

### Best Practices (Branchenstandard)

Laut [SponsorCX 2025 Event Guide](https://www.sponsorcx.com/2025-event-sponsorship-guide/):
- Sponsor-Tiers mit unterschiedlicher Sichtbarkeit
- Strategische Platzierung (Header = Premium, Footer = Standard)
- Logo-Integration auf allen Touchpoints (Print, Digital, Live)

---

## Akzeptanzkriterien

### AC-1: Veranstaltungs-Logo Upload

- [ ] Bild-Upload im Turnier-Wizard (Step "Stammdaten")
- [ ] Unterstützte Formate: PNG, JPG, SVG, WebP
- [ ] Maximale Dateigröße: 2 MB
- [ ] Vorschau nach Upload
- [ ] Logo erscheint im PDF-Header (links oder zentriert)
- [ ] Logo erscheint in der Live-Anzeige

### AC-2: Sponsor-Logos (Multi-Upload)

- [ ] Mehrere Sponsoren hinzufügbar (min. 1, max. 8)
- [ ] Pro Sponsor: Name + Logo + Tier (Gold/Silber/Bronze)
- [ ] Drag & Drop Reihenfolge
- [ ] Tier bestimmt Größe und Position:
  - **Gold**: Groß, Header-Bereich, max. 2
  - **Silber**: Mittel, unter Header, max. 3
  - **Bronze**: Klein, Footer, unbegrenzt
- [ ] Sponsor-Logos erscheinen im PDF-Footer

### AC-3: Logo-Validierung

- [ ] Mindestauflösung: 200x200px
- [ ] Seitenverhältnis-Warnung bei extremen Formaten (> 4:1)
- [ ] Automatische Größenoptimierung für Storage
- [ ] Base64-Encoding für IndexedDB-Speicherung

### AC-4: PDF-Integration

- [ ] Event-Logo: Header, 60x60px (skaliert)
- [ ] Gold-Sponsor: Header rechts, 50x50px
- [ ] Silber/Bronze-Sponsor: Footer-Leiste
- [ ] Logos skalieren mit PDF-Format (A3/A4/A2)

### AC-5: Live-Anzeige Integration

- [ ] Event-Logo in Tournament-Header
- [ ] Sponsor-Logos in Footer oder Sidebar
- [ ] Optional: Sponsor-Rotation bei mehreren Logos

---

## UI-Konzept

### Turnier-Wizard: Branding-Sektion

```
┌─────────────────────────────────────────────────────────────┐
│ Stammdaten                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Turniername:  [Stadtmeisterschaft 2025            ]        │
│  Datum:        [15.03.2025                         ]        │
│                                                             │
│  ┌─ Veranstaltungs-Logo ─────────────────────────────────┐  │
│  │                                                        │  │
│  │   ┌──────────┐                                        │  │
│  │   │          │   [Logo hochladen]                     │  │
│  │   │  [Logo]  │   oder hierher ziehen                  │  │
│  │   │          │                                        │  │
│  │   └──────────┘   PNG, JPG, SVG • Max 2MB              │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Sponsoren ───────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  🥇 Gold-Sponsor                                       │  │
│  │  ┌────────┐  Name: [Stadtwerke Musterstadt    ]       │  │
│  │  │ [Logo] │  [Logo hochladen]                         │  │
│  │  └────────┘                                [✕ Entf.]  │  │
│  │                                                        │  │
│  │  🥈 Silber-Sponsor                                     │  │
│  │  ┌────────┐  Name: [Autohaus Schmidt          ]       │  │
│  │  │ [Logo] │  [Logo hochladen]                         │  │
│  │  └────────┘                                [✕ Entf.]  │  │
│  │                                                        │  │
│  │  [+ Sponsor hinzufügen]                                │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### PDF-Layout mit Logos

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────┐                                         ┌──────┐   │
│ │ Logo │     STADTMEISTERSCHAFT 2025             │ Gold │   │
│ └──────┘          U12 Hallenfußball              │Spons.│   │
│                                                   └──────┘   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    [Spielplan-Inhalt]                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Sponsoren:  [Silber1]  [Silber2]  [Bronze1]  [Bronze2]    │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Datenmodell-Erweiterung

```typescript
// src/types/tournament.ts

interface SponsorLogo {
  id: string;
  name: string;
  logo: string;              // Base64-encoded oder Data-URL
  tier: 'gold' | 'silver' | 'bronze';
  url?: string;              // Optional: Link zur Sponsor-Website
}

interface TournamentBranding {
  eventLogo?: string;        // Base64-encoded
  sponsors?: SponsorLogo[];
}

interface Tournament {
  // ... bestehende Felder
  branding?: TournamentBranding;
}
```

### Neue Komponenten

```
src/features/branding/
├── components/
│   ├── LogoUploader.tsx         # Drag & Drop Upload
│   ├── LogoPreview.tsx          # Vorschau mit Crop-Option
│   ├── SponsorEditor.tsx        # Sponsor hinzufügen/bearbeiten
│   ├── SponsorList.tsx          # Sortierbare Liste
│   └── SponsorTierBadge.tsx     # Gold/Silber/Bronze Badge
├── hooks/
│   ├── useLogoUpload.ts         # Upload-Logik
│   └── useImageOptimization.ts  # Komprimierung
└── utils/
    ├── imageValidation.ts       # Format/Größe prüfen
    └── imageCompression.ts      # Base64-Optimierung
```

### PDF-Exporter Änderungen

```typescript
// src/lib/pdfExporter.ts

function renderHeader(doc: jsPDF, branding: TournamentBranding) {
  if (branding?.eventLogo) {
    doc.addImage(branding.eventLogo, 'PNG', 10, 10, 20, 20);
  }

  const goldSponsor = branding?.sponsors?.find(s => s.tier === 'gold');
  if (goldSponsor?.logo) {
    doc.addImage(goldSponsor.logo, 'PNG', 180, 10, 15, 15);
  }
}

function renderFooter(doc: jsPDF, branding: TournamentBranding) {
  const sponsors = branding?.sponsors?.filter(s => s.tier !== 'gold') || [];
  const y = doc.internal.pageSize.height - 15;

  sponsors.forEach((sponsor, i) => {
    const x = 10 + i * 25;
    doc.addImage(sponsor.logo, 'PNG', x, y, 12, 12);
  });
}
```

### Storage-Überlegungen

- **IndexedDB-Limit**: ~50MB pro Origin
- **Logo-Optimierung**: Max 100KB pro Logo nach Komprimierung
- **8 Sponsoren + 1 Event-Logo**: ~900KB worst case
- **Empfehlung**: Bilder vor Speicherung auf max. 400x400px skalieren

---

## Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/tournament.ts` | SponsorLogo, TournamentBranding Interfaces |
| `src/screens/TournamentCreationScreen.tsx` | Branding-Sektion in Stammdaten |
| `src/lib/pdfExporter.ts` | Logo-Rendering in Header/Footer |
| `src/components/schedule/TournamentHeader.tsx` | Event-Logo anzeigen |
| `src/components/schedule/TournamentFooter.tsx` | Sponsor-Logos anzeigen |
| `src/utils/storage.ts` | Prüfen: Logo-Größen-Handling |

---

## Implementierungsphasen

### Phase 1: Datenmodell & Upload (2h)
- [ ] TournamentBranding Interface
- [ ] LogoUploader Komponente
- [ ] Image-Validierung und Komprimierung

### Phase 2: Wizard-Integration (2h)
- [ ] Branding-Sektion in Stammdaten-Step
- [ ] Sponsor-Editor mit Tier-Auswahl
- [ ] Vorschau-Funktionalität

### Phase 3: PDF-Integration (2h)
- [ ] Header-Logo-Rendering
- [ ] Footer-Sponsor-Leiste
- [ ] Skalierung für verschiedene Formate

### Phase 4: Live-Anzeige (1h)
- [ ] TournamentHeader mit Logo
- [ ] TournamentFooter mit Sponsoren
- [ ] Responsive Darstellung

---

## Abgrenzung

**In Scope:**
- Veranstaltungs-Logo Upload und Anzeige
- Sponsor-Logos mit Tier-System
- PDF-Integration
- Live-Anzeige-Integration

**Out of Scope:**
- Team-Logos (→ US-TEAM-LOGOS)
- Farbschema-Anpassung (→ US-CORPORATE-COLORS)
- Video-Overlays für Streaming
- Animierte Logos

---

## Verwandte User Stories

- **US-TEAM-LOGOS**: Vereinslogos pro Team
- **US-CORPORATE-COLORS**: Farbschema anpassen
- **US-PDF-FORMATS**: Logo-Skalierung für A3/A2
