# US-GROUPS-AND-FIELDS: Gruppen & Felder Konfiguration

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-GROUPS-AND-FIELDS |
| **Priorität** | Medium |
| **Status** | Draft |
| **Erstellt** | 2025-12-24 |
| **Kategorie** | Turnier-Wizard |
| **Impact** | Mittel - Bessere Anpassbarkeit |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** Gruppennamen, Feldnamen und die Zuordnung von Gruppen zu Feldern konfigurieren können,
**damit** ich das Turnier an meine Bedürfnisse anpassen kann (z.B. thematische Namen, räumliche Trennung von Gruppen).

---

## Kontext

### Neuer Wizard-Tab

Ein neuer Tab **"Gruppen & Felder"** wird zwischen "Modus" und "Teams" eingefügt:

```
[Sportart] → [Modus] → [Gruppen & Felder] → [Teams] → [Zeiten] → [Zusammenfassung]
```

### Use Cases

1. **Thematische Gruppennamen**: "Löwen", "Tiger" statt "Gruppe A", "Gruppe B"
2. **Feldnamen**: "Halle Nord", "Halle Süd" statt "Feld 1", "Feld 2"
3. **Räumliche Trennung**: Gruppe A spielt nur in Halle Nord (für getrennte Veranstaltungsorte)
4. **Altersklassen**: U10 auf Feld 1, U12 auf Feld 2

### Default-Verhalten

- Gruppennamen: "Gruppe A", "Gruppe B", ...
- Feldnamen: "Feld 1", "Feld 2", ...
- Zuordnung: Alle Gruppen spielen auf allen Feldern (wie bisher)

---

## Akzeptanzkriterien

### AC-1: Gruppennamen bearbeiten

- [ ] Inline-Editor für jeden Gruppennamen
- [ ] Optionales Kürzel (max 3 Zeichen) für kompakte Anzeigen
- [ ] Validierung: Name nicht leer, max 30 Zeichen
- [ ] Bei leerem Kürzel: Erster Buchstabe des Namens wird verwendet

### AC-2: Feldnamen bearbeiten

- [ ] Inline-Editor für jeden Feldnamen
- [ ] Optionales Kürzel (max 3 Zeichen)
- [ ] Validierung: Name nicht leer, max 30 Zeichen
- [ ] Bei leerem Kürzel: "F1", "F2", etc. als Fallback

### AC-3: Gruppen-Feld-Zuordnung

- [ ] Pro Gruppe: Multi-Select welche Felder erlaubt sind
- [ ] Default: Alle Felder ausgewählt (wie bisher)
- [ ] Mindestens ein Feld pro Gruppe muss ausgewählt sein
- [ ] Warnung wenn Zuordnung zu Konflikten führen könnte (z.B. 4 Gruppen, 1 Feld)
- [ ] Spielplan-Generator berücksichtigt Zuordnung

### AC-4: Konsistente Anzeige

- [ ] Gruppennamen erscheinen überall identisch:
  - Wizard
  - Teams & Gruppen Tab
  - Spielplan
  - Live-Ticker
  - Präsentation/Monitor
  - PDF-Export
- [ ] Feldnamen erscheinen überall identisch:
  - Spielplan
  - Live-Ansicht
  - PDF-Export

### AC-5: Wizard-Integration

- [ ] Tab zwischen "Modus" und "Teams" eingefügt
- [ ] Tab ist optional überspringbar (Defaults werden verwendet)
- [ ] Bei Änderung der Gruppenanzahl im Modus-Tab: Neue Gruppen mit Default-Namen
- [ ] Bei Änderung der Feldanzahl: Neue Felder mit Default-Namen
- [ ] Über "Erweiterte Bearbeitung" in Settings nachträglich editierbar

---

## UI-Konzept

### Wizard Tab "Gruppen & Felder"

```
┌─────────────────────────────────────────────────────────────┐
│ Gruppen & Felder                                            │
│                                                             │
│ ┌─ Gruppen ───────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  Gruppe A  [Löwen                    ] Kürzel: [LÖ ]   │ │
│ │            Felder: [✓] Feld 1  [✓] Feld 2              │ │
│ │                                                         │ │
│ │  Gruppe B  [Tiger                    ] Kürzel: [TI ]   │ │
│ │            Felder: [✓] Feld 1  [✓] Feld 2              │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Felder ────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  Feld 1    [Halle Nord               ] Kürzel: [HN ]   │ │
│ │  Feld 2    [Halle Süd                ] Kürzel: [HS ]   │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [Überspringen]  [Weiter →]     │
└─────────────────────────────────────────────────────────────┘
```

### Kompakte Ansicht (nur Zuordnung ändern)

```
┌─────────────────────────────────────────────────────────────┐
│ Gruppen-Feld-Zuordnung                                      │
│                                                             │
│              │ Feld 1 │ Feld 2 │ Feld 3 │                   │
│ ─────────────┼────────┼────────┼────────┤                   │
│ Löwen (A)    │   ✓    │   ✓    │   ✓    │                   │
│ Tiger (B)    │   ✓    │   ✓    │   ✓    │                   │
│ Bären (C)    │   ✓    │   ✓    │   ✓    │                   │
│                                                             │
│ ⚠️ Tipp: Wenn alle Gruppen alle Felder nutzen können,       │
│    wird der Spielplan optimal verteilt.                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Datenmodell-Erweiterungen

```typescript
// src/types/tournament.ts

interface TournamentGroup {
  id: string;           // z.B. "group-a"
  defaultName: string;  // "Gruppe A" (unveränderlich)
  customName?: string;  // "Löwen"
  shortCode?: string;   // "LÖ" (max 3 Zeichen)
  allowedFieldIds: string[];  // NEU: Erlaubte Felder
  teams: Team[];
}

interface TournamentField {
  id: string;           // z.B. "field-1"
  defaultName: string;  // "Feld 1" (unveränderlich)
  customName?: string;  // "Halle Nord"
  shortCode?: string;   // "HN" (max 3 Zeichen)
}

interface TournamentConfig {
  // ... bestehende Felder
  groups: TournamentGroup[];
  fields: TournamentField[];  // NEU: Explizite Feld-Objekte
}
```

### Gekapselte Komponenten

```
src/components/shared/
├── GroupDisplay.tsx          # Zeigt Gruppenname (custom oder default)
├── GroupBadge.tsx            # Kompakte Anzeige mit Kürzel
├── FieldDisplay.tsx          # Zeigt Feldname (custom oder default)
├── FieldBadge.tsx            # Kompakte Anzeige mit Kürzel
└── hooks/
    ├── useGroupName.ts       # Hook für Gruppenname-Auflösung
    └── useFieldName.ts       # Hook für Feldname-Auflösung
```

### Utility Functions

```typescript
// src/utils/displayNames.ts

export function getGroupDisplayName(group: TournamentGroup): string {
  return group.customName || group.defaultName;
}

export function getGroupShortCode(group: TournamentGroup): string {
  if (group.shortCode) return group.shortCode;
  if (group.customName) return group.customName.substring(0, 2).toUpperCase();
  return group.defaultName.replace('Gruppe ', '');
}

export function getFieldDisplayName(field: TournamentField): string {
  return field.customName || field.defaultName;
}

export function getFieldShortCode(field: TournamentField): string {
  if (field.shortCode) return field.shortCode;
  if (field.customName) return field.customName.substring(0, 2).toUpperCase();
  return `F${field.defaultName.replace('Feld ', '')}`;
}
```

### Spielplan-Generator Anpassung

```typescript
// src/utils/scheduleGenerator.ts

function generateSchedule(config: TournamentConfig): Match[] {
  // Bei Gruppen-Feld-Zuordnung:
  // - Spiele einer Gruppe nur auf erlaubten Feldern planen
  // - Validierung: Genug Kapazität auf erlaubten Feldern?

  for (const match of groupMatches) {
    const group = getGroupForMatch(match);
    const allowedFields = group.allowedFieldIds;

    // Nur auf erlaubten Feldern planen
    match.fieldId = findAvailableField(allowedFields, match.time);
  }
}
```

### Komponenten-Struktur

```
src/features/groups-and-fields/
├── GroupsAndFieldsStep.tsx       # Wizard-Tab Container
├── components/
│   ├── GroupEditor.tsx           # Einzelne Gruppe bearbeiten
│   ├── FieldEditor.tsx           # Einzelnes Feld bearbeiten
│   ├── GroupFieldMatrix.tsx      # Zuordnungs-Matrix
│   └── CapacityWarning.tsx       # Warnung bei Konflikten
├── hooks/
│   ├── useGroupsAndFields.ts     # State Management
│   └── useCapacityCheck.ts       # Kapazitäts-Validierung
└── utils/
    └── capacityCalculation.ts    # Berechnung ob Zuordnung möglich
```

### Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/tournament.ts` | TournamentGroup, TournamentField erweitern |
| `src/features/tournament-creation/TournamentWizard.tsx` | Neuen Step einfügen |
| `src/features/tournament-creation/constants.ts` | Step-Reihenfolge anpassen |
| `src/utils/scheduleGenerator.ts` | Feld-Zuordnung berücksichtigen |
| `src/utils/displayNames.ts` | NEU: Utility für Namen-Auflösung |
| `src/components/shared/GroupDisplay.tsx` | NEU: Gekapselte Komponente |
| `src/components/shared/FieldDisplay.tsx` | NEU: Gekapselte Komponente |
| `src/features/pdf-export/*` | Gekapselte Komponenten nutzen |
| `src/features/schedule/*` | Gekapselte Komponenten nutzen |
| `src/features/tournament-management/TeamsTab.tsx` | Gekapselte Komponenten nutzen |

---

## Implementierungsphasen

### Phase 1: Datenmodell & Utilities (2h)
- [ ] TournamentGroup um customName, shortCode, allowedFieldIds erweitern
- [ ] TournamentField Interface erstellen
- [ ] displayNames.ts Utility erstellen
- [ ] Migration für bestehende Turniere

### Phase 2: Gekapselte Komponenten (2h)
- [ ] GroupDisplay, GroupBadge Komponenten
- [ ] FieldDisplay, FieldBadge Komponenten
- [ ] useGroupName, useFieldName Hooks
- [ ] Bestehende Stellen refactoren

### Phase 3: Wizard-Tab (3h)
- [ ] GroupsAndFieldsStep Container
- [ ] GroupEditor, FieldEditor Komponenten
- [ ] GroupFieldMatrix für Zuordnung
- [ ] In Wizard-Flow integrieren

### Phase 4: Spielplan-Generator (2h)
- [ ] Feld-Zuordnung in Generator berücksichtigen
- [ ] Kapazitäts-Validierung
- [ ] CapacityWarning Komponente

### Phase 5: Integration (2h)
- [ ] Alle Stellen auf gekapselte Komponenten umstellen
- [ ] PDF-Export anpassen
- [ ] Tests

---

## Kapselung - Vorteile

Durch die Kapselung in `GroupDisplay` und `FieldDisplay`:

1. **Single Source of Truth**: Name-Auflösung nur an einer Stelle
2. **Konsistenz**: Überall identische Darstellung
3. **Wartbarkeit**: Änderungen nur an einer Stelle
4. **Testbarkeit**: Komponenten isoliert testbar

```tsx
// Vorher (überall verstreut):
<span>{group.customName || group.defaultName}</span>

// Nachher (gekapselt):
<GroupDisplay group={group} />
<GroupDisplay group={group} variant="badge" />  // Kompakt
<GroupDisplay group={group} variant="short" />  // Nur Kürzel
```

---

## Abgrenzung

**In Scope:**
- Gruppennamen ändern
- Gruppenkürzel
- Feldnamen ändern
- Feldkürzel
- Gruppen-Feld-Zuordnung
- Konsistente Anzeige überall

**Out of Scope:**
- Finalrunden-Bezeichnungen (→ US-FINALS-NAMING)
- Namens-Presets (Tiere, Farben, etc.) (→ Future)
- Dynamisches Hinzufügen von Gruppen/Feldern (→ bestehende Wizard-Logik)

---

## Verwandte User Stories

- **US-FINALS-NAMING**: Finalrunden-Bezeichnungen anpassen (extrahiert aus US-CUSTOM-GROUP-NAMES)
- **US-SCHEDULE-EDITOR**: Nutzt Feld-Zuordnung für Validierung
