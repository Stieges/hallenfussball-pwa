# Hallenfußball PWA - Code Index

Schnellreferenz für die wichtigsten Code-Strukturen und deren Zweck.

## 🏗️ Architektur-Übersicht

### Core-Flow: Turniererstellung → Spielplan → Anzeige
1. **Tournament Creation** → Step1-4 → Preview → Publish
2. **Schedule Generation** → scheduleGenerator.ts → playoffScheduler → ScheduleDisplay
3. **Display** → FinalStageSchedule / GroupStageSchedule → PDF Export

---

## 📁 Datei-Struktur & Verantwortlichkeiten

### `/src/types/tournament.ts` - Zentrale Type Definitions
**Wichtige Types:**
- `FinalsPreset`: 'none' | 'final-only' | 'top-4' | 'top-8' | 'top-16' | 'all-places'
- `FinalsConfig`: { preset, parallelSemifinals, parallelQuarterfinals, parallelRoundOf16 }
- `RefereeMode`: 'none' | 'organizer' | 'teams'
- `FinalsRefereeMode`: 'none' | 'neutralTeams' | 'nonParticipatingTeams'
- `RefereeConfig`: { mode, numberOfReferees?, maxConsecutiveMatches?, refereeNames?, finalsRefereeMode?, manualAssignments? }
- `Tournament`: Haupt-Datenstruktur
- `Match`: Spiel-Objekt (teamA, teamB, isFinal, finalType, label, slot, field, referee?)
- `ScheduledMatch`: Spiel mit Zeit (matchNumber, time, homeTeam, awayTeam, phase, referee?)

**Wichtige Felder:**
- `tournament.finalsConfig` - Neue preset-basierte Finalrunden-Konfiguration
- `tournament.refereeConfig` - Schiedsrichter-Konfiguration (Modus, Anzahl, Einstellungen)
- `match.slot` - Zeitslot vom Fair Scheduler
- `match.referee` - Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.)
- `match.isFinal` - Boolean ob Finalrunden-Spiel

---

### `/src/lib/scheduleGenerator.ts` - Hauptlogik Spielplan-Generierung
**Zweck**: Kombiniert Gruppenphase + Playoffs zu komplettem Zeitplan mit Uhrzeiten + Schiedsrichter-Zuweisung

**Wichtige Funktionen:**
- `generateFullSchedule(tournament)` - **Hauptfunktion**: Generiert kompletten Schedule
  - Zeile 208-220: Gruppenphase schedulen
  - Zeile 223-247: Finalrunde schedulen (mit durchgehender matchNumber!)
  - Zeile 230-233: **Berechnung startMatchNumber** für Finalrunde
  - Zeile 324-337: **Schiedsrichter-Zuweisung** über assignReferees()
- `scheduleMatches(matches, startTime, ..., startMatchNumber)` - Weist Uhrzeiten zu
  - Zeile 361: **matchNumber beginnt bei startMatchNumber** (nicht mehr bei 1!)
- `resolveTeamName(teamId, teamMap, locale)` - Übersetzt Team-IDs
  - Zeile 467-476: Prüft teamMap, sonst translatePlaceholder
- `translatePlaceholder(placeholder, locale)` - Übersetzt Playoff-Platzhalter
  - Zeile 482-605: **Übersetzungstabelle DE/EN**
  - Unterstützt: group-x-1st, semi1-winner, semi1-loser, qf1-winner, r16-1-winner

**Wichtige Übersetzungen (Deutsch):**
- `'semi1-winner'` → `'Sieger HF 1'`
- `'semi1-loser'` → `'Verlierer HF 1'`
- `'qf1-winner'` → `'Sieger VF 1'`
- `'r16-1-winner'` → `'Sieger AF 1'`

---

### `/src/lib/playoffGenerator.ts` - Playoff Match Definitions
**Zweck**: Generiert Playoff-Spiel-Definitionen basierend auf Preset

**Wichtige Funktionen:**
- `generatePlayoffMatches(numberOfGroups, finalsConfig)` - Switch über Presets
- `generateTop4(numberOfGroups)` - Halbfinale + Finale + Platz 3
  - Zeile 149-150: Platz 3 mit 'semi1-loser', 'semi2-loser'
  - Zeile 157-158: Finale mit 'semi1-winner', 'semi2-winner'
- `generateTop8(numberOfGroups)` - Viertelfinale + Rest
- `generateTop16(numberOfGroups)` - **Achtelfinale + Rest** (8+ Gruppen)
  - Zeile 226-233: 8 Achtelfinale-Spiele (r16-1 bis r16-8)
- `generateAllPlaces(numberOfGroups)` - Alle Platzierungen

**Match-Struktur:**
```typescript
{
  id: 'semi1',
  label: '1. Halbfinale',
  home: 'group-a-2nd',    // Team-Platzhalter
  away: 'group-b-1st',
  rank?: 1,
  dependsOn: []
}
```

---

### `/src/utils/playoffScheduler.ts` - Playoff Scheduling
**Zweck**: Wandelt Playoff-Definitionen in schedulierte Matches um

**Wichtige Funktionen:**
- `generatePlayoffDefinitions(numberOfGroups, finalsConfig)` - Konvertiert zu Definitions
  - Zeile 64-99: Erstellt PlayoffMatchDefinition mit parallelMode
  - Zeile 66-80: **Parallel Mode Detection** (r16, qf, semi)
  - Zeile 93-94: **teamASource / teamBSource** = match.home / match.away
- `generatePlayoffSchedule(options)` - Scheduliert Matches auf Felder/Slots
  - Topological Sort für Dependencies
  - Sequential vs Parallel Execution

**PlayoffMatchDefinition:**
```typescript
{
  id: string,
  label: string,
  teamASource: string,   // z.B. 'semi1-loser'
  teamBSource: string,   // z.B. 'semi2-loser'
  finalType?: 'final' | 'thirdPlace',
  parallelMode: 'sequentialOnly' | 'parallelAllowed',
  dependencies: string[]
}
```

---

### `/src/lib/refereeAssigner.ts` - Schiedsrichter-Zuweisung
**Zweck**: Automatische und manuelle Zuweisung von Schiedsrichtern zu Spielen

**Wichtige Funktionen:**
- `assignReferees<T>(matches, teams, config)` - **Hauptfunktion**: Weist SR zu allen Matches zu
  - Zeile 38-57: Switch über mode: 'organizer' | 'teams' | 'none'
  - Zeile 48: Wendet zuerst manuelle Zuweisungen an
- `assignOrganizerReferees(matches, config)` - **Veranstalter-Modus**
  - Zeile 72-174: Faire Verteilung mit Workload-Tracking
  - Zeile 104-106: Tracking von refereeWorkload + refereeLastSlots
  - Zeile 113-139: **Sortierung**: Primary = least workload, Secondary = longest rest
  - Zeile 133: Prüfung maxConsecutive Constraint
- `assignTeamReferees(matches, teams)` - **Teams-Modus**
  - Zeile 171-246: Teams pfeifen nach eigenem Spiel
  - Zeile 200-214: Gruppierung nach Feldern
  - Zeile 208: Home-Team vom vorherigen Spiel wird SR
- `applyManualAssignments(matches, config)` - Überschreibt automatische Zuweisung
  - Zeile 49-74: Wendet config.manualAssignments an
- `getRefereeDisplayName(refereeNumber, config, teams)` - Display-Namen
  - Zeile 254-278: SR1/SR2 oder Team-Namen oder Custom-Namen

**Algorithmus Organizer-Modus:**
```typescript
// Fair Distribution:
1. Sortiere Matches nach Zeitslot
2. Für jedes Match:
   - Sortiere Referees nach: 1) Workload, 2) Rest-Zeit
   - Prüfe maxConsecutive Constraint
   - Weise SR mit niedrigster Belastung zu
3. Fallback: Bei Constraint-Verletzung → SR mit längster Pause
```

**MatchLike Interface:**
- Generische Schnittstelle für Match + ScheduledMatch
- Unterstützt teamA/teamB (Match) und homeTeam/awayTeam (ScheduledMatch)

---

### `/src/components/RefereeAssignmentEditor.tsx` - Manuelle SR-Zuweisung
**Zweck**: UI für manuelle SR-Zuweisung mit Drag & Drop und Konflikt-Erkennung

**Wichtige Funktionen:**
- `findOverlappingConflict(matches, targetMatchId, refereeNumber)` - **Zeitliche Konflikt-Erkennung**
  - Zeile 21-47: Prüft ob SR bereits zeitgleich bei anderem Spiel eingeteilt ist
  - Zeile 34-42: Zeit-Overlap-Logik: `(start1 < end2) AND (start2 < end1)`
  - Gibt konfligierendes Match zurück oder null

**Komponenten:**
- Zeile 270-297: Draggable Referee Cards (nur Organizer-Modus)
- Zeile 304-358: Matches-Liste mit Dropzones und Dropdown-Selects
- Zeile 324-355: `<Select>` mit Konflikt-Prüfung und Bestätigungs-Dialog

**Konflikt-Behandlung:**
- Zeile 136-155: Drag & Drop - Zeigt window.confirm() bei Zeitkonflikt
- Zeile 332-348: Dropdown - Zeigt window.confirm() bei Zeitkonflikt
- User kann Konflikt überschreiben (manuell hat Vorrang)

**Wichtige Features:**
- Workload-Anzeige: `{refereeWorkload[refNum] || 0} Spiele`
- Reset-Button: Setzt alle manuellen Zuweisungen zurück
- Nur zeitliche Überschneidungen werden geprüft (KEINE maxConsecutive-Regeln)

---

### `/src/constants/finalsOptions.ts` - Tournament Planner Logic
**Zweck**: Bestimmt empfohlene vs. mögliche Finalrunden-Varianten

**Wichtige Funktionen:**
- `getFinalsOptions(numberOfGroups)` - Gibt FinalsOption[] zurück
  - 2 Gruppen: top-4, all-places (recommended) | final-only (possible)
  - 4 Gruppen: top-8, top-4 (recommended)
  - 8+ Gruppen: **top-16, top-8, top-4 (recommended)**
- `getRecommendedFinalsPreset(numberOfGroups)` - Default-Preset
  - 2-3 Gruppen → 'top-4'
  - 4-7 Gruppen → 'top-8'
  - 8+ Gruppen → **'top-16'**

---

### `/src/components/schedule/FinalStageSchedule.tsx` - Display Component
**Zweck**: Zeigt Finalrunden-Spiele in Tabellenform mit optionaler SR-Spalte

**Wichtige Elemente:**
- Zeile 27: `showReferees` - Bedingte Anzeige der SR-Spalte
- Zeile 108: `<th>SR</th>` - SR-Header (zweite Spalte nach Nr.)
- Zeile 118-119: `match.matchNumber` - **Durchgehende Spielnummer**
- Zeile 159-164: `{match.homeTeam} - {match.awayTeam}` - **Übersetzte Team-Namen**
- Zeile 121-156: SR-Zelle mit editierbarem Dropdown oder statischer Anzeige
- `getFinalMatchLabel(match)` - Bestimmt Spiel-Label (🏆 Finale, 🥉 Platz 3)

**Props:**
- `editable?: boolean` - Ermöglicht direkte SR-Änderung in Tabelle
- `onRefereeChange?: (matchId, refereeNumber) => void` - Callback für SR-Änderungen

**Editable Mode:**
- Zeile 29-47: `getRefereeOptions()` - Generiert Dropdown-Optionen (SR-Namen + Spieleanzahl)
- Zeile 124-149: Native `<select>` mit onChange-Handler für direkte SR-Auswahl
- Zeile 127-129: Konvertiert Dropdown-Wert zu refereeNumber und ruft Callback auf

---

### `/src/components/schedule/GroupStageSchedule.tsx` - Display Component
**Zweck**: Zeigt Gruppenphase-Spiele in Tabellenform mit optionaler SR-Spalte

**Wichtige Elemente:**
- Zeile 29: `showReferees` - Bedingte Anzeige der SR-Spalte
- Zeile 107: `<th>SR</th>` - SR-Header (zweite Spalte nach Nr.)
- Zeile 122-156: SR-Zelle mit editierbarem Dropdown oder statischer Anzeige

**Props:**
- `editable?: boolean` - Ermöglicht direkte SR-Änderung in Tabelle
- `onRefereeChange?: (matchId, refereeNumber) => void` - Callback für SR-Änderungen

**Editable Mode:**
- Zeile 31-49: `getRefereeOptions()` - Generiert Dropdown-Optionen (SR-Namen + Spieleanzahl)
- Zeile 125-149: Native `<select>` mit onChange-Handler für direkte SR-Auswahl
- Zeile 127-129: Konvertiert Dropdown-Wert zu refereeNumber und ruft Callback auf

---

## 🔄 Datenfluss: Turniererstellung mit SR

```
1. User wählt Preset + SR-Modus in Step2_ModeAndSystem.tsx
   ↓ finalsConfig: { preset: 'top-4', parallelSemifinals: true }
   ↓ refereeConfig: { mode: 'organizer', numberOfReferees: 3, maxConsecutiveMatches: 1 }

2. playoffGenerator.generatePlayoffMatches(numberOfGroups, finalsConfig)
   ↓ Erstellt PlayoffMatch[] mit home/away Platzhaltern
   ↓ z.B. { home: 'semi1-loser', away: 'semi2-loser' }

3. playoffScheduler.generatePlayoffDefinitions()
   ↓ Konvertiert zu PlayoffMatchDefinition[]
   ↓ teamASource = 'semi1-loser', teamBSource = 'semi2-loser'

4. playoffScheduler.generatePlayoffSchedule()
   ↓ Erstellt Match[] mit Slots/Fields
   ↓ teamA = 'semi1-loser', teamB = 'semi2-loser'

5. scheduleGenerator.scheduleMatches()
   ↓ Erstellt ScheduledMatch[] mit Zeiten
   ↓ homeTeam = resolveTeamName('semi1-loser') → 'Verlierer HF 1'
   ↓ matchNumber = fortlaufend ab startMatchNumber

6. scheduleGenerator: assignReferees()
   ↓ refereeAssigner.assignReferees(allMatches, teams, refereeConfig)
   ↓ Weist SR-Nummern zu: match.referee = 1, 2, 3...
   ↓ Respektiert manualAssignments

7. TournamentPreview.tsx
   ↓ Zeigt ScheduleDisplay mit editable=true
   ↓ Passes onRefereeChange={handleRefereeAssignment}

8. ScheduleDisplay → GroupStageSchedule / FinalStageSchedule
   ↓ Props: editable, onRefereeChange werden durchgereicht
   ↓ SR-Spalte als zweite Spalte (nach Nr.)

9a. Editable Mode (Preview):
   ↓ Dropdown <select> in SR-Spalte erlaubt direkte Änderung
   ↓ onChange → onRefereeChange(matchId, refereeNumber)
   ↓ TournamentPreview: regeneriert Schedule mit neuer Zuweisung

9b. RefereeAssignmentEditor:
   ↓ Alternative UI mit Drag & Drop
   ↓ findOverlappingConflict() prüft zeitliche Konflikte
   ↓ window.confirm() bei Overlap, User kann überschreiben
```

---

## 🎯 Häufige Änderungen & wo sie gemacht werden

### Neue Playoff-Runde hinzufügen (z.B. Top-32)
1. **tournament.ts**: Erweitere `FinalsPreset` um `'top-32'`
2. **tournament.ts**: Erweitere `FinalsConfig` um `parallelRoundOf32?`
3. **playoffGenerator.ts**: Erstelle `generateTop32()` Funktion
4. **finalsOptions.ts**: Füge Top-32 zu `getFinalsOptions()` hinzu
5. **scheduleGenerator.ts**: Erweitere `translatePlaceholder()` um r32-x-winner/loser
6. **playoffScheduler.ts**: Erweitere parallelMode Detection um Round of 32

### Schiedsrichter-Algorithmus anpassen
**Datei**: `/src/lib/refereeAssigner.ts`
- `assignOrganizerReferees()` - Zeile 72-174: Fair Distribution Logik
- `assignTeamReferees()` - Zeile 171-246: Teams-Modus Logik
- Workload-Tracking: `refereeWorkload[]` und `refereeLastSlots[]`

### SR-Anzeige in UI ändern
**Dateien**:
- `/src/components/schedule/FinalStageSchedule.tsx` - Zeile 121-156: Editable Dropdown oder statische Anzeige
- `/src/components/schedule/GroupStageSchedule.tsx` - Zeile 122-156: Editable Dropdown oder statische Anzeige
- `/src/components/ScheduleDisplay.tsx` - Props: editable, onRefereeChange durchreichen
- `/src/features/tournament-creation/TournamentPreview.tsx` - Zeile 332-336: editable=true übergeben
- `/src/lib/pdfExporter.ts` - Zeile 507: Zeige referee number

### Team-Namen Übersetzung ändern
**Datei**: `/src/lib/scheduleGenerator.ts`, Zeile 482-605
- Deutsche Übersetzungen: `translations.de`
- Englische Übersetzungen: `translations.en`

### Spielnummern-Logik ändern
**Datei**: `/src/lib/scheduleGenerator.ts`, Zeile 230-233
```typescript
const startMatchNumber = scheduledGroupStage.length > 0
  ? scheduledGroupStage[scheduledGroupStage.length - 1].matchNumber + 1
  : 1;
```

### Finalrunden-Empfehlungen ändern
**Datei**: `/src/constants/finalsOptions.ts`
- `getFinalsOptions()` - Ändere category: 'recommended' | 'possible'
- `getRecommendedFinalsPreset()` - Ändere Default-Logik

---

## 🐛 Debugging-Tipps

### Problem: "semi1-loser" wird nicht übersetzt
**Check**: `scheduleGenerator.ts` Zeile 482-605 - Ist Platzhalter in Übersetzungstabelle?

### Problem: Finalrunde beginnt bei Spiel 1
**Check**: `scheduleGenerator.ts` Zeile 230-233 - Wird startMatchNumber korrekt berechnet?

### Problem: Playoff-Matches werden nicht generiert
**Check Console**: `[ScheduleGenerator] Playoff check:` und `Generated playoff matches:`
**Check**: `tournament.finalsConfig.preset` ist nicht 'none'

### Problem: Falsche Parallelisierung
**Check**: `playoffScheduler.ts` Zeile 66-80 - parallelMode Detection
**Check**: `tournament.finalsConfig.parallelSemifinals` etc.

### Problem: SR werden nicht zugewiesen
**Check Console**: Logs in `refereeAssigner.ts`
**Check**: `tournament.refereeConfig.mode` ist nicht 'none'
**Check**: `refereeConfig.numberOfReferees` ist gesetzt (Organizer-Modus)

### Problem: SR-Spalte wird nicht angezeigt
**Check**: `schedule.refereeConfig` wird korrekt durchgereicht
**Check**: `showReferees = refereeConfig && refereeConfig.mode !== 'none'`
**Check**: `tournament.refereeConfig` initialisiert (TournamentCreationScreen.tsx Zeile 53-55)

### Problem: Unfaire SR-Verteilung
**Check**: `refereeAssigner.ts` Zeile 104-139 - Workload-Sortierung
**Check**: `maxConsecutiveMatches` Constraint wird respektiert

### Problem: SR können in Tabelle nicht geändert werden
**Check**: `editable={true}` wird an ScheduleDisplay übergeben (TournamentPreview.tsx)
**Check**: `onRefereeChange` Callback ist definiert und durchgereicht
**Check**: Props werden korrekt an GroupStageSchedule/FinalStageSchedule übergeben

### Problem: Zeitkonflikte werden nicht erkannt
**Check**: `findOverlappingConflict()` in RefereeAssignmentEditor.tsx Zeile 21-47
**Check**: Zeitstempel-Vergleich: `(start1 < end2) AND (start2 < end1)`
**Check**: Konflikt-Dialog wird bei window.confirm() angezeigt

---

## 📊 Wichtige Enums & Constants

### Phase Types
```typescript
'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final'
```

### Final Types
```typescript
'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth'
```

### Parallel Modes
```typescript
'sequentialOnly' | 'parallelAllowed'
```

### Referee Modes
```typescript
RefereeMode: 'none' | 'organizer' | 'teams'
FinalsRefereeMode: 'none' | 'neutralTeams' | 'nonParticipatingTeams'
```

### RefereeConfig Structure
```typescript
{
  mode: RefereeMode;
  numberOfReferees?: number;          // Anzahl SR (Organizer-Modus)
  maxConsecutiveMatches?: number;     // Max. aufeinanderfolgende Spiele
  refereeNames?: Record<number, string>; // 1 → "Max Mustermann"
  finalsRefereeMode?: FinalsRefereeMode;
  manualAssignments?: Record<string, number>; // matchId → refereeNumber
}
```

---

## 🔗 Abhängigkeiten zwischen Komponenten

```
TournamentCreationScreen
  ↓ Step2_ModeAndSystem (finalsConfig + refereeConfig)
  ↓ TournamentPreview
    ↓ handleRefereeAssignment(matchId, refereeNumber)
    ↓ generateFullSchedule()
      ↓ generatePlayoffDefinitions()
        ↓ generatePlayoffMatches()
      ↓ scheduleMatches()
        ↓ resolveTeamName()
          ↓ translatePlaceholder()
      ↓ assignReferees()
        ↓ applyManualAssignments()
        ↓ assignOrganizerReferees() | assignTeamReferees()
    ↓ ScheduleDisplay (editable, onRefereeChange)
      ↓ FinalStageSchedule (editable, onRefereeChange, refereeConfig)
      ↓ GroupStageSchedule (editable, onRefereeChange, refereeConfig)
    ↓ RefereeAssignmentEditor (onAssignmentChange, onResetAssignments)
      ↓ findOverlappingConflict()
    ↓ pdfExporter (schedule.refereeConfig)
```

---

## 📝 Neue Features & TODOs

### ✅ Implementiert
- TypeScript Types für Schiedsrichter-System
- UI für Schiedsrichter-Konfiguration in Step2
- Algorithmus für faire SR-Verteilung (Organizer + Teams Modus)
- SR-Zuweisung in scheduleGenerator integriert
- SR-Spalte in PDF Export
- SR-Anzeige in Schedule-Komponenten (GroupStage + FinalStage)
- **Manuelle SR-Zuweisung UI (Editable Mode)**
  - Direkte Änderung in Tabellen via Dropdown (GroupStage + FinalStage)
  - RefereeAssignmentEditor mit Drag & Drop Interface
  - Zeitliche Konflikt-Erkennung (findOverlappingConflict)
  - User-Bestätigung bei Überschneidungen
  - Reset-Funktion für automatische Zuweisung
  - Nur Zeit-Overlaps werden geprüft (KEINE maxConsecutive-Regeln bei manueller Zuweisung)

### 📋 Geplant
- Finals-Referee-Mode Logic (neutralTeams, nonParticipatingTeams)
- SR-Namen Konfiguration UI
- Admin View für manuelle Anpassungen während Turnier
- Live-Tracking Integration

---

**Last Updated**: 2025-11-27
**Version**: 1.2 (Manuelle SR-Zuweisung mit Konflikt-Erkennung)
