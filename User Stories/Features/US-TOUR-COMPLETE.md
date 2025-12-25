# US-TOUR-COMPLETE: Turnier manuell beenden

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOUR-COMPLETE |
| **Priorität** | Medium |
| **Status** | Partial (Backend fertig, UI offen) |
| **Erstellt** | 2024-12-24 |
| **Kategorie** | Turnier-Management |

---

## User Story

**Als** Turnierleiter
**möchte ich** ein Turnier manuell als beendet markieren können
**damit** ich flexible Kontrolle über den Turnierstatus habe (z.B. bei Abbruch, vorzeitigem Ende)

---

## Kontext

### Aktuelle Logik (bereits implementiert)
Ein Turnier wechselt automatisch in "Beendet" wenn:
1. **Match-basiert**: Alle Spiele haben Ergebnisse (Gruppenphase + Finale)
2. **Zeitbasiert**: Turnierdatum liegt in der Vergangenheit (Fallback)

### Problem
Es fehlt die Möglichkeit, ein Turnier manuell zu beenden für Sonderfälle:
- Turnierabbruch (Wetter, Unfall, etc.)
- Vorzeitiges Ende
- Korrektur eines falschen Status

### Bereits implementiert
- `Tournament.manuallyCompleted?: boolean` - Flag für manuellen Override
- `Tournament.completedAt?: string` - Zeitstempel der Beendigung
- `isTournamentCompleted()` - Prüflogik in `tournamentCategories.ts`

---

## Acceptance Criteria

### Basis-Funktionalität

1. **AC1:** Given ein laufendes Turnier, When ich "Turnier beenden" klicke, Then wird ein Bestätigungsdialog angezeigt.

2. **AC2:** Given der Bestätigungsdialog, When ich bestätige, Then wird `manuallyCompleted=true` und `completedAt` gesetzt.

3. **AC3:** Given ein manuell beendetes Turnier, When ich das Dashboard öffne, Then erscheint es in "Beendete Turniere".

### Erweiterte Funktionalität

4. **AC4:** Given ein manuell beendetes Turnier, When ich "Turnier fortsetzen" klicke, Then kann ich den Status zurücksetzen (falls irrtümlich beendet).

5. **AC5:** Given ein beendetes Turnier, When ich es öffne, Then wird ein visueller Hinweis angezeigt (z.B. Banner "Turnier beendet").

---

## UX-Hinweise

### Button-Platzierung (Optionen)

| Option | Ort | Pro | Contra |
|--------|-----|-----|--------|
| **A** | SettingsTab | Passt zu Admin-Aktionen | Versteckt |
| **B** | Match-Cockpit Header | Schnell erreichbar | Könnte überladen wirken |
| **C** | Dashboard-Karte | Direkter Zugriff | Nur für laufende Turniere sichtbar |
| **D** | Floating Action Button | Prominent | Könnte stören |

### Empfehlung
Option **A** (SettingsTab) mit deutlicher Warnung:
- Passt zur bestehenden "Gefährliche Aktionen"-Sektion
- Weniger Risiko für versehentliches Beenden

### Visuelles Design
- Button: Sekundär oder Warning-Style
- Bestätigungsdialog mit Warnung
- Evtl. optionaler Grund-Eintrag (für Protokoll)

---

## Technische Hinweise

### Bereits implementiert
```typescript
// src/types/tournament.ts
manuallyCompleted?: boolean;
completedAt?: string;

// src/utils/tournamentCategories.ts
export function isTournamentCompleted(tournament: Tournament): boolean
```

### Noch zu implementieren
```typescript
// Funktion zum Beenden
function completeTournament(tournament: Tournament): Tournament {
  return {
    ...tournament,
    manuallyCompleted: true,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Funktion zum Fortsetzen (optional)
function resumeTournament(tournament: Tournament): Tournament {
  return {
    ...tournament,
    manuallyCompleted: false,
    completedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
}
```

### Betroffene Dateien
- UI-Komponente (noch zu bestimmen)
- `useTournamentStorage.ts` - Update-Logik
- Optional: Bestätigungsdialog-Komponente

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Ersetzt** | - |
| **Ersetzt durch** | - |
| **Abhängig von** | - |
| **Defects** | - |
