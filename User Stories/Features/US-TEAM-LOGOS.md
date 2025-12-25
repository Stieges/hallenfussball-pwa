# US-TEAM-LOGOS: Vereinslogos pro Team

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TEAM-LOGOS |
| **Priorität** | Medium |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Aktualisiert** | 2025-12-25 |
| **Kategorie** | Branding |
| **Impact** | Hoch - Visuelle Team-Identität und Professionalität |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** für jedes Team ein Vereins-/Mannschaftslogo hochladen können,
**damit** die Teams in Spielplänen, Tabellen und der Live-Anzeige visuell unterscheidbar sind und professionell präsentiert werden.

---

## Kontext

### Aktueller Stand

- **Team-Interface** hat nur `id`, `name`, `group` - kein Logo-Feld
- Teams werden nur durch Namen unterschieden
- Bei ähnlichen Teamnamen (z.B. "FC Bayern I" vs "FC Bayern II") schwer unterscheidbar

### Use Cases

1. **Vereinsturnier**: Jede Mannschaft mit eigenem Vereinswappen
2. **Stadtmeisterschaft**: Unterschiedliche Vereine mit eigenen Logos
3. **Firmen-Cup**: Firmenlogos der teilnehmenden Unternehmen
4. **Schulturnier**: Schulwappen für jede teilnehmende Schule

### Best Practices

Laut [Jersey Watch](https://www.jerseywatch.com/blog/best-sports-team-management-software/) und [TeamLinkt](https://teamlinkt.com/):
- Team-Logos als kleine Icons (16-32px) neben Teamnamen
- Konsistente Darstellung über alle Ansichten
- Fallback bei fehlendem Logo (Initialen-Badge)

---

## Akzeptanzkriterien

### AC-1: Team-Logo Upload

- [ ] Logo-Upload pro Team im Wizard (Step "Teams")
- [ ] Unterstützte Formate: PNG, JPG, SVG, WebP
- [ ] Maximale Dateigröße: 500 KB (vor Komprimierung)
- [ ] Quadratisches Format empfohlen (wird automatisch zugeschnitten)
- [ ] Automatische Skalierung auf max. 128x128 px
- [ ] Komprimierung auf max. 50 KB nach Verarbeitung
- [ ] Vorschau nach Upload

### AC-2: Fallback bei fehlendem Logo

- [ ] Initialen-Badge als Fallback (z.B. "FCB" für "FC Bayern")
- [ ] Hintergrundfarbe basierend auf Teamname (deterministisch)
- [ ] Optional: Team-Farbe manuell wählbar
- [ ] Kontrastfarbe für Text automatisch berechnet

### AC-3: Anzeige im Spielplan

- [ ] Logo neben Teamnamen in Spielpaarungen
  - Team-Liste: 32x32 px
  - Spielplan-Zeilen: 24x24 px
  - MatchCockpit Scoreboard: 48x48 px
  - Gruppentabellen: 24x24 px
  - Monitor-Ansicht: 64x64 px

### AC-4: PDF-Integration

- [ ] Logos in Spielplan-Tabelle (wenn aktiviert)
- [ ] Logos in Gruppentabellen
- [ ] Option: "Logos im PDF anzeigen" (Default: Ein)
- [ ] Qualität: Mindestens 150 DPI für Druck
- [ ] Logo-Größe skaliert mit PDF-Format (A4/A3/A2)

### AC-5: Live-Anzeige

- [ ] Logos im Match-Cockpit
- [ ] Logos in der Live-Ticker-Ansicht
- [ ] Logos auf dem Präsentations-Monitor

### AC-6: Performance

- [ ] Turnier mit 20+ Teams und Logos lädt in unter 2 Sekunden
- [ ] Lazy Loading für nicht sichtbare Logos
- [ ] Alle Logos werden mit Turnier in IndexedDB gespeichert
- [ ] Warnung bei Storage-Limit (>4MB)

### AC-7: Bulk-Import (Optional)

- [ ] CSV-Import mit Logo-URL-Spalte
- [ ] Automatisches Herunterladen der Logos
- [ ] Fehlerbehandlung bei ungültigen URLs

---

## UI-Konzept

### Team-Editor mit Logo

```
┌─────────────────────────────────────────────────────────────┐
│ Teams                                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Gruppe A ────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  ┌────┐  FC Musterstadt           [Logo hochladen]    │  │
│  │  │Logo│  ────────────────────────                     │  │
│  │  └────┘                                               │  │
│  │                                                        │  │
│  │  ┌────┐  SV Beispieldorf          [Logo hochladen]    │  │
│  │  │ BD │  ────────────────────────  (Initialen-Badge)  │  │
│  │  └────┘                                               │  │
│  │                                                        │  │
│  │  ┌────┐  TSV Testheim             [Logo hochladen]    │  │
│  │  │Logo│  ────────────────────────                     │  │
│  │  └────┘                                               │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Spielplan mit Logos

```
┌─────────────────────────────────────────────────────────────┐
│ Spielplan - Vorrunde                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nr │ Zeit  │ Feld │ Heim              │ vs │ Gast          │
│  ───┼───────┼──────┼───────────────────┼────┼───────────────│
│   1 │ 09:00 │  1   │ 🔵 FC Musterstadt │    │ 🟢 SV Beisp.  │
│   2 │ 09:00 │  2   │ 🔴 TSV Testheim   │    │ 🟡 VfB Demo   │
│   3 │ 09:15 │  1   │ 🟢 SV Beisp.      │    │ 🔴 TSV Testh. │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Initialen-Badge Generator

```
┌──────────────────────────────────────────────────────────┐
│ Team ohne Logo                                            │
│                                                           │
│  ┌─────┐                                                  │
│  │     │  FC Bayern München → "FCB" (blau Hintergrund)   │
│  │ FCB │                                                  │
│  │     │  Generiert aus: Ersten Buchstaben der Wörter    │
│  └─────┘  Max. 3 Zeichen                                  │
│                                                           │
│  Hintergrundfarbe: Hash des Teamnamens → Farbe           │
│  Schriftfarbe: Weiß oder Schwarz (Kontrast)              │
└──────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Datenmodell-Erweiterung

```typescript
// src/types/tournament.ts

interface Team {
  id: string;
  name: string;
  group?: string;
  logo?: string;           // Base64-encoded oder Data-URL
  primaryColor?: string;   // Optional, für Initialen-Badge
}
```

### Bild-Komprimierung

```typescript
// src/utils/imageProcessing.ts

async function processTeamLogo(file: File): Promise<string> {
  const MAX_SIZE = 128;
  const MAX_BYTES = 50 * 1024; // 50KB

  // Resize
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height, 1);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Compress
  let quality = 0.8;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  while (dataUrl.length > MAX_BYTES && quality > 0.3) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}
```

### Initialen-Badge Logik

```typescript
// src/utils/teamBranding.ts

/**
 * Generiert Initialen aus Teamname
 * "FC Bayern München" → "FCB"
 * "SV Werder Bremen" → "SWB"
 */
export function getTeamInitials(name: string): string {
  const words = name.split(/\s+/);
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3);
  return initials || '?';
}

/**
 * Generiert deterministische Farbe aus Teamname
 */
export function getTeamColor(name: string): string {
  const hash = hashString(name);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

/**
 * Berechnet Kontrastfarbe (Weiß oder Schwarz)
 */
export function getContrastColor(bgColor: string): string {
  // Luminanz-Berechnung
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
```

### TeamLogo Komponente

```typescript
// src/components/shared/TeamLogo.tsx

interface TeamLogoProps {
  team: Team;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showFallback?: boolean;
}

export function TeamLogo({ team, size = 'sm', showFallback = true }: TeamLogoProps) {
  const sizeMap = { xs: 16, sm: 24, md: 32, lg: 48, xl: 64 };
  const px = sizeMap[size];

  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        style={{ width: px, height: px, borderRadius: 4, objectFit: 'cover' }}
      />
    );
  }

  if (!showFallback) return null;

  const initials = getTeamInitials(team.name);
  const bgColor = team.primaryColor || getTeamColor(team.name);
  const textColor = getContrastColor(bgColor);

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: 4,
        backgroundColor: bgColor,
        color: textColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: px * 0.4,
        fontWeight: 'bold',
      }}
    >
      {initials}
    </div>
  );
}
```

---

## Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/tournament.ts` | Team um `logo`, `primaryColor` erweitern |
| `src/components/shared/TeamLogo.tsx` | NEU: Logo/Badge Komponente |
| `src/utils/teamBranding.ts` | NEU: Initialen, Farben-Logik |
| `src/utils/imageProcessing.ts` | NEU: Bild-Komprimierung |
| `src/features/tournament-creation/Step4_Teams.tsx` | Logo-Upload pro Team |
| `src/components/schedule/GroupStageSchedule.tsx` | TeamLogo in Spielpaarungen |
| `src/components/schedule/GroupTables.tsx` | TeamLogo in Tabellen |
| `src/components/schedule/FinalStageSchedule.tsx` | TeamLogo in Playoffs |
| `src/lib/pdfExporter.ts` | Team-Logos im PDF rendern |
| `src/components/match-cockpit/*.tsx` | TeamLogo in Live-Ansicht |

---

## Implementierungsphasen

### Phase 1: Basis-Upload (MVP, 3-4h)
- [ ] Team-Interface erweitern
- [ ] TeamLogo Komponente mit Fallback
- [ ] teamBranding Utilities
- [ ] Upload-Button im Team-Editor
- [ ] Bild-Komprimierung

### Phase 2: Überall anzeigen (2h)
- [ ] GroupStageSchedule mit Logos
- [ ] GroupTables mit Logos
- [ ] FinalStageSchedule mit Logos
- [ ] MatchCockpit Scoreboard

### Phase 3: PDF & Monitor (2h)
- [ ] PDF-Rendering mit Team-Logos
- [ ] Monitor-Ansicht mit größeren Logos
- [ ] Präsentations-Ansicht

### Phase 4: Optimierungen (2h)
- [ ] Lazy Loading für Performance
- [ ] IndexedDB-Warnung bei Limit
- [ ] Bulk-Import (Optional)

---

## Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Storage-Limit | Hoch | Aggressive Komprimierung, Warnung |
| Langsames Laden | Mittel | Lazy Loading, Thumbnails |
| Falsche Formate | Niedrig | Validierung beim Upload |
| PDF-Qualität | Mittel | Mindest-Auflösung prüfen |

---

## Abgrenzung

**In Scope:**
- Einzelnes Logo pro Team
- Automatischer Initialen-Badge als Fallback
- Anzeige in Spielplan, Tabellen, Live
- PDF-Integration

**Out of Scope:**
- Trikot-Farben-System (→ Future)
- Team-Galerie/Fotos
- Video-Inhalte
- Animierte Logos

---

## Verwandte User Stories

- **US-LOGO-INTEGRATION**: Event- und Sponsor-Logos
- **US-CORPORATE-COLORS**: Farbschema des Turniers
- **US-PDF-FORMATS**: Logo-Qualität in verschiedenen Formaten
- **TOUR-EDIT-TEAMS**: Team-Verwaltung
- **MON-TV-01**: Monitor-Ansicht
