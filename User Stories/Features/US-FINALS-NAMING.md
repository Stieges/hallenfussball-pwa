# US-FINALS-NAMING: Finalrunden-Bezeichnungen anpassen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-FINALS-NAMING |
| **Priorität** | Low |
| **Status** | Draft |
| **Erstellt** | 2025-12-24 |
| **Ursprung** | Extrahiert aus US-CUSTOM-GROUP-NAMES |
| **Kategorie** | Turnier-Management |
| **Impact** | Niedrig - Nice-to-have |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** Finalrunden-Bezeichnungen anpassen können,
**damit** ich eigene Namen für Halbfinale, Finale etc. verwenden kann (z.B. "Großes Finale", "Kleines Finale").

---

## Kontext

### Ist-Zustand
- Finalrunden heißen immer "Halbfinale 1", "Halbfinale 2", "Finale", etc.
- Keine Möglichkeit zur Anpassung

### Soll-Zustand
- Anpassbare Bezeichnungen für alle Finalrunden-Spiele
- Presets behalten ihre Default-Namen, können aber überschrieben werden

---

## Akzeptanzkriterien

### AC-1: Finalrunden-Namen bearbeiten

- [ ] In Playoff-Einstellungen: Editor für Rundennamen
- [ ] Default-Namen werden bei Preset-Auswahl gesetzt
- [ ] Überschreibbar mit eigenem Namen
- [ ] Anzeige überall: Spielplan, Live, PDF

### AC-2: Typische Anpassungen

- [ ] "Halbfinale 1" → "Kleines Halbfinale"
- [ ] "Finale" → "Großes Finale"
- [ ] "Spiel um Platz 3" → "Kleines Finale"

### AC-3: Konsistenz

- [ ] Gekapselte Komponente `FinalsRoundDisplay` nutzen
- [ ] Gleiche Bezeichnung in allen Ansichten

---

## UI-Konzept

```
┌─────────────────────────────────────────────────────────────┐
│ Playoff-Einstellungen                                       │
│                                                             │
│ Preset: [Top 4 (Halbfinale + Finale)        ▼]             │
│                                                             │
│ ┌─ Runden-Bezeichnungen ──────────────────────────────────┐ │
│ │                                                         │ │
│ │  Halbfinale 1    [Kleines Halbfinale        ]          │ │
│ │  Halbfinale 2    [Großes Halbfinale         ]          │ │
│ │  Spiel um Platz 3 [Kleines Finale           ]          │ │
│ │  Finale          [Großes Finale             ]          │ │
│ │                                                         │ │
│ │  [Auf Defaults zurücksetzen]                           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Datenmodell

```typescript
interface FinalsRoundConfig {
  id: string;           // z.B. "semifinal-1"
  defaultLabel: string; // "Halbfinale 1"
  customLabel?: string; // "Kleines Halbfinale"
}

interface PlayoffConfig {
  preset: string;
  rounds: FinalsRoundConfig[];
}
```

### Gekapselte Komponente

```tsx
// src/components/shared/FinalsRoundDisplay.tsx

interface Props {
  round: FinalsRoundConfig;
  variant?: 'full' | 'short';
}

export function FinalsRoundDisplay({ round, variant = 'full' }: Props) {
  const label = round.customLabel || round.defaultLabel;
  return <span>{label}</span>;
}
```

---

## Aufwand

| Task | Aufwand |
|------|---------|
| Datenmodell | 0.5h |
| Editor-UI | 1h |
| Komponente + Integration | 1h |
| **Gesamt** | ~2.5h |

---

## Verwandte User Stories

- **US-GROUPS-AND-FIELDS**: Gruppennamen (extrahiert hierher)
- **US-PLAYOFF-CUSTOMIZATION**: Wenn vorhanden, dort integrieren
