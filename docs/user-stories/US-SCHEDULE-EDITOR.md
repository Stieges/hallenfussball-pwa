# US-SCHEDULE-EDITOR: Dynamischer Spielplan-Editor

## Meta

| Feld | Wert |
|------|------|
| **ID** | US-SCHEDULE-EDITOR |
| **Titel** | Dynamischer Spielplan-Editor mit Echtzeit-Aktualisierung |
| **Priorität** | Hoch |
| **Aufwand** | ~15-20h |
| **Abhängigkeiten** | Bestehender Spielplan, Turnierleitung |

---

## User Story

**Als** Turnierveranstalter
**möchte ich** den Spielplan während des Turniers flexibel anpassen können und Echtzeit-Aktualisierungen der Spielzeiten sehen,
**damit** ich auf Verzögerungen, Änderungen und unvorhergesehene Situationen reagieren kann.

---

## Akzeptanzkriterien

### AC-1: Autonome Spielzeiten mit Konflikt-Erkennung
- [ ] Spiele laufen autonom auf ihrer geplanten Zeit
- [ ] Tatsächliche Start-/Endzeit wird erfasst wenn Spiel über TL gestartet/beendet wird
- [ ] **Konflikt-Erkennung**: System prüft vor Spielstart ob Konflikte bestehen:
  - Team spielt noch in einem anderen laufenden Spiel
  - Schiedsrichter pfeift noch ein anderes laufendes Spiel
  - Feld ist noch durch laufendes Spiel belegt
- [ ] Bei Konflikt: Spiel zeigt Status "WARTET" mit Grund (z.B. "Bayern noch in Spiel 3")
- [ ] Spiel kann erst gestartet werden wenn Konflikt aufgelöst ist
- [ ] Keine automatische Zeit-Propagierung - Spiele behalten geplante Zeit

### AC-2: Übersprungene Spiele
- [ ] Spiele die übersprungen wurden (nächstes Spiel wurde gestartet ohne dieses) werden markiert
- [ ] Anzeige: Uhrzeit fehlt, Status "Übersprungen" oder ähnlich
- [ ] Übersprungene Spiele werden automatisch ans Ende des Spielplans verschoben
- [ ] Im Editor können übersprungene Spiele manuell neu positioniert werden

### AC-3: Editor-Modus
- [ ] Button "Editor" im Spielplan-Tab aktiviert Bearbeitungsmodus
- [ ] Visueller Unterschied zwischen Normal- und Editor-Modus (z.B. farbiger Rahmen)
- [ ] "Abbrechen" verwirft alle Änderungen
- [ ] "Speichern" validiert und speichert Änderungen

### AC-4: Drag & Drop für Paarungen
- [ ] Spiele können per Drag & Drop verschoben werden
- [ ] Beim Verschieben tauschen zwei Spiele ihre Slots (Zeit, Feld)
- [ ] Spiele MIT Ergebnis sind gesperrt (visuell markiert, nicht verschiebbar)
- [ ] Drag-Handle oder ganzes Spiel als Drag-Target

### AC-5: Schiedsrichter & Feld bearbeiten
- [ ] SR und Feld sind im Editor direkt änderbar (Dropdown/Picker)
- [ ] NUR bei Spielen MIT Ergebnis → Weiterleitung zum Korrektur-Workflow
- [ ] Änderungen werden erst beim Speichern übernommen

### AC-6: Automatische Neuzuweisung
- [ ] Button "Schiedsrichter & Felder neu zuweisen"
- [ ] Gilt nur für Spiele OHNE Ergebnis
- [ ] Nutzt bestehenden Fair-Scheduler-Algorithmus
- [ ] Berücksichtigt konfigurierte SR-Pausenslots
- [ ] Optional: Checkbox "Manuelle Zuweisungen behalten"

### AC-7: Validierung beim Speichern
- [ ] Prüfung auf Team-Konflikte (Team spielt gleichzeitig 2x)
- [ ] Prüfung auf SR-Konflikte (SR pfeift gleichzeitig 2x)
- [ ] Prüfung auf Feld-Konflikte (Feld doppelt belegt)
- [ ] Anzeige aller Konflikte in übersichtlicher Liste
- [ ] Option "Konflikte ignorieren (nicht empfohlen)" oder "Zurück zum Editor"

### AC-8: Visuelle Indikatoren
- [ ] Spiele mit Ergebnis: 🔒 Gesperrt-Icon
- [ ] Wartende Spiele: ⏳ WARTET + Konflikt-Grund
- [ ] Übersprungene Spiele: ⏭️ ÜBERSPRUNGEN
- [ ] Editor-Konflikte: ⚠️ Warnung-Icon am betroffenen Spiel
- [ ] Geänderte Spiele: Farbliche Hervorhebung bis zum Speichern

---

## Technisches Konzept

### Datenmodell-Erweiterungen

```typescript
// src/types/tournament.ts erweitern

interface ScheduleMatch {
  // Bestehend
  id: string;
  matchNumber: number;
  homeTeam: Team;
  awayTeam: Team;
  scheduledTime: string;      // Geplante Zeit (ISO)
  field: number;
  referee?: Team;
  groupId: string;

  // NEU
  actualStartTime?: string;   // Tatsächliche Startzeit (ISO)
  actualEndTime?: string;     // Tatsächliche Endzeit (ISO)
  status: MatchStatus;
}

type MatchStatus =
  | 'scheduled'    // Normal geplant
  | 'waiting'      // Wartet wegen Konflikt (Team/SR/Feld belegt)
  | 'running'      // Läuft gerade
  | 'paused'       // Pausiert
  | 'finished'     // Beendet (hat Ergebnis)
  | 'skipped';     // Übersprungen (ans Ende verschoben)

// Editor State
interface ScheduleEditorState {
  isEditing: boolean;
  pendingChanges: ScheduleChange[];
  conflicts: ScheduleConflict[];
}

interface ScheduleChange {
  matchId: string;
  type: 'move' | 'referee' | 'field';
  oldValue: any;
  newValue: any;
}

interface ScheduleConflict {
  type: 'team' | 'referee' | 'field';
  matchIds: [string, string];
  time: string;
  description: string;
}
```

### Konflikt-Erkennungs-Logik

```typescript
// src/utils/scheduleConflicts.ts

interface ScheduleConflict {
  type: 'team' | 'referee' | 'field';
  blockingMatchId: string;
  blockedMatchId: string;
  reason: string;  // z.B. "Bayern noch in Spiel 3"
  estimatedAvailableAt?: string;  // Wann Konflikt voraussichtlich aufgelöst
}

function detectConflicts(
  matchToStart: ScheduleMatch,
  runningMatches: ScheduleMatch[]
): ScheduleConflict[] {
  // 1. Prüfe ob Teams des Spiels in laufenden Spielen sind
  // 2. Prüfe ob SR des Spiels in laufendem Spiel pfeift
  // 3. Prüfe ob Feld durch laufendes Spiel belegt ist
  // 4. Gib alle gefundenen Konflikte zurück
}

function canStartMatch(
  match: ScheduleMatch,
  runningMatches: ScheduleMatch[]
): { canStart: boolean; conflicts: ScheduleConflict[] } {
  const conflicts = detectConflicts(match, runningMatches);
  return { canStart: conflicts.length === 0, conflicts };
}
```

### Komponenten-Struktur

```
src/features/schedule-editor/
├── ScheduleEditor.tsx              # Haupt-Container
├── components/
│   ├── EditorToolbar.tsx           # Editor/Speichern/Abbrechen Buttons
│   ├── DraggableMatch.tsx          # Einzelnes verschiebbares Spiel
│   ├── MatchSlot.tsx               # Drop-Target für Spiele
│   ├── LockedMatchIndicator.tsx    # Gesperrt-Anzeige
│   ├── SkippedMatchBadge.tsx       # Übersprungen-Anzeige
│   ├── ConflictWarning.tsx         # Konflikt-Anzeige
│   ├── RefereeFieldPicker.tsx      # SR/Feld Auswahl
│   ├── ReassignDialog.tsx          # "Neu zuweisen" Dialog
│   └── ConflictSummaryDialog.tsx   # Validierungs-Ergebnis
├── hooks/
│   ├── useScheduleEditor.ts        # Editor-State Management
│   ├── useScheduleValidation.ts    # Editor-Validierung beim Speichern
│   ├── useMatchConflicts.ts        # Live-Konflikt-Erkennung
│   └── useDragAndDrop.ts           # DnD-Logik
└── utils/
    ├── scheduleConflicts.ts        # Konflikt-Erkennung (Team/SR/Feld)
    └── refereeReassignment.ts      # Neuzuweisungs-Algorithmus
```

### Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/tournament.ts` | ScheduleMatch erweitern |
| `src/features/tournament-management/ScheduleTab.tsx` | Editor-Integration |
| `src/hooks/useLiveMatchManagement.ts` | actualStartTime setzen |
| `src/utils/scheduleGenerator.ts` | Status-Handling |
| `src/utils/fairScheduler.ts` | Neuzuweisung für Teilmenge |

---

## UI-Mockups

### Spielplan Normal-Modus

```
┌─────────────────────────────────────────────────────────────┐
│ Spielplan                                        [Editor]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 15:00  Spiel 1  │ Bayern vs 1860      │ Feld 1 │ SR: Löwen │
│        ✅ 2:1   │                      │        │           │
│                                                             │
│ 15:12  Spiel 2  │ Freiburg vs Stuttgart│ Feld 2 │ SR: Bayern│
│        ✅ 1:1   │                      │        │           │
│                                                             │
│ 15:24  Spiel 3  │ Löwen vs Augsburg   │ Feld 1 │ SR: 1860  │
│        🔴 LIVE  │                      │        │           │
│                                                             │
│ 15:24  Spiel 4  │ Bayern vs Freiburg  │ Feld 2 │ SR: Nürnb.│
│        ⏳ WARTET │ ← Bayern noch in Spiel 3                 │
│                                                             │
│ --:--  Spiel 5  │ Nürnberg vs Fürth   │ Feld 1 │ SR: Freib.│
│   ⏭️ ÜBERSPRUNGEN                      │        │           │
│                                                             │
│ 15:36  Spiel 6  │ 1860 vs Stuttgart   │ Feld 1 │ SR: Augsb.│
│                 │                      │        │           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Spielplan Editor-Modus

```
┌─────────────────────────────────────────────────────────────┐
│ Spielplan - EDITOR        [Neu zuweisen] [Abbrechen] [Speichern] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔒 Spiel 1  │ Bayern vs 1860      │ Feld 1 │ SR: Löwen │ │
│ │    ✅ 2:1   │ (Ergebnis vorhanden - gesperrt)          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔒 Spiel 2  │ Freiburg vs Stuttgart│ Feld 2 │ SR: Bayern│ │
│ │    ✅ 1:1   │ (Ergebnis vorhanden - gesperrt)          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ≡ Spiel 3  │ Löwen vs Augsburg   │[Feld ▼]│[SR ▼]      │ │
│ │   🔴 LIVE  │                      │        │           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌───────────────────────────────── GEÄNDERT ───────────────┐ │
│ │ ≡ Spiel 5  │ 1860 vs Freiburg    │[Feld ▼]│[SR ▼]      │ │
│ │            │ ↕️ Mit Spiel 4 getauscht                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌───────────────────────────────── GEÄNDERT ───────────────┐ │
│ │ ≡ Spiel 4  │ Nürnberg vs Fürth   │[Feld ▼]│[SR ▼]      │ │
│ │   ⏭️       │ ↕️ Mit Spiel 5 getauscht                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Neuzuweisungs-Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ Schiedsrichter & Felder neu zuweisen                  [✕]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ℹ️ Betrifft 8 Spiele ohne Ergebnis                         │
│                                                             │
│ Optionen:                                                   │
│ ☑ Schiedsrichter neu zuweisen                              │
│ ☑ Felder neu zuweisen                                      │
│ ☐ Manuelle Zuweisungen behalten                            │
│                                                             │
│ SR-Pausenslots berücksichtigen:                            │
│ ☑ Aktiviert (aus Turnier-Einstellungen)                    │
│                                                             │
│                              [Abbrechen] [Neu zuweisen]     │
└─────────────────────────────────────────────────────────────┘
```

### Konflikt-Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ 2 Konflikte gefunden                               [✕]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚠️ Team-Konflikt                                        │ │
│ │ FC Bayern spielt gleichzeitig in:                       │ │
│ │ • Spiel 5 (15:30, Feld 1)                              │ │
│ │ • Spiel 6 (15:30, Feld 2)                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚠️ Schiedsrichter-Konflikt                              │ │
│ │ SR "TSV 1860" pfeift gleichzeitig:                      │ │
│ │ • Spiel 3 (15:15, Feld 1)                              │ │
│ │ • Spiel 4 (15:15, Feld 2)                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Konflikte ignorieren (nicht empfohlen)] [Zurück zum Editor]│
└─────────────────────────────────────────────────────────────┘
```

---

## Implementierungsphasen

### Phase 1: Datenmodell & Basis (3h)
- [ ] ScheduleMatch um neue Felder erweitern
- [ ] MatchStatus Typ hinzufügen
- [ ] actualStartTime bei Spielstart setzen (useLiveMatchManagement)

### Phase 2: Konflikt-Erkennung (3h)
- [ ] scheduleConflicts.ts Utility (detectConflicts, canStartMatch)
- [ ] useMatchConflicts Hook
- [ ] "WARTET" Status-Anzeige mit Konflikt-Grund

### Phase 3: Übersprungene Spiele (2h)
- [ ] Erkennung von übersprungenen Spielen
- [ ] Automatisches Verschieben ans Ende
- [ ] SkippedMatchBadge Komponente

### Phase 4: Editor-Grundgerüst (4h)
- [ ] ScheduleEditor Container
- [ ] EditorToolbar (Editor/Speichern/Abbrechen)
- [ ] useScheduleEditor Hook (State Management)
- [ ] Visueller Editor-Modus

### Phase 5: Drag & Drop (4h)
- [ ] DraggableMatch Komponente
- [ ] MatchSlot Drop-Target
- [ ] useDragAndDrop Hook
- [ ] Gesperrte Spiele (mit Ergebnis)

### Phase 6: SR/Feld Bearbeitung (2h)
- [ ] RefereeFieldPicker Komponente
- [ ] Integration in Editor
- [ ] Weiterleitung zu Korrektur-Workflow bei Ergebnis-Spielen

### Phase 7: Neuzuweisung (3h)
- [ ] ReassignDialog Komponente
- [ ] refereeReassignment.ts (nutzt Fair Scheduler)
- [ ] SR-Pausenslot Berücksichtigung

### Phase 8: Validierung (2h)
- [ ] useScheduleValidation Hook
- [ ] conflictDetection.ts Utility
- [ ] ConflictSummaryDialog Komponente

### Phase 9: Polish & Test (2h)
- [ ] Edge Cases testen
- [ ] Performance-Optimierung
- [ ] Responsive Design

---

## Offene Punkte

1. **Undo/Redo**: Soll es im Editor Undo/Redo geben?
2. **Konflikt-Warnung in TL**: Soll die Turnierleitung beim Spielstart warnen wenn Konflikte bestehen?

---

## Abgrenzung

**In Scope:**
- Echtzeit-Aktualisierung der Zeiten
- Übersprungene Spiele markieren
- Drag & Drop Editor
- SR/Feld Bearbeitung
- Automatische Neuzuweisung
- Konflikt-Validierung

**Out of Scope:**
- Neue Spiele hinzufügen
- Spiele löschen
- Gruppen ändern
- Team-Namen ändern
