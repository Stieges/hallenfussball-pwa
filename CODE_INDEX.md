# Hallenfußball PWA - Code Index

Vollständige Schnellreferenz für die Codebase mit allen Features und deren Implementierung.

## 🏗️ Architektur-Übersicht

### Core-Flow: Turniererstellung → Spielplan → PDF Export
1. **Tournament Creation** → Step1-4 → Preview → Publish
2. **Schedule Generation** → scheduleGenerator.ts → playoffScheduler → fairScheduler
3. **Display** → ScheduleDisplay → GroupStageSchedule / FinalStageSchedule
4. **PDF Export** → pdfExporter.ts → HTML-basiertes Layout → jsPDF + autoTable

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
- `ScheduledMatch`: Spiel mit Zeit (matchNumber, time, homeTeam, awayTeam, phase, referee?, startTime, endTime)
- `Standing`: Tabelleneintrag (team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points)
- `PlacementCriterion`: Platzierungslogik (id: 'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'wins' | 'directComparison', enabled)

**Wichtige Felder:**
- `tournament.finalsConfig` - Neue preset-basierte Finalrunden-Konfiguration
- `tournament.refereeConfig` - Schiedsrichter-Konfiguration (Modus, Anzahl, Einstellungen)
- `tournament.fieldAssignments` - Manuelle Feld-Zuweisungen (matchId → fieldNumber)
- `tournament.placementLogic` - Platzierungskriterien mit Reihenfolge
- `match.slot` - Zeitslot vom Fair Scheduler
- `match.referee` - Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.)
- `match.field` - Feld-Nummer (1, 2, 3, ...)
- `match.isFinal` - Boolean ob Finalrunden-Spiel

---

### `/src/lib/scheduleGenerator.ts` - Hauptlogik Spielplan-Generierung
**Zweck**: Kombiniert Gruppenphase + Playoffs zu komplettem Zeitplan mit Uhrzeiten + Schiedsrichter-Zuweisung

**Wichtige Funktionen:**
- `generateFullSchedule(tournament)` - **Hauptfunktion**: Generiert kompletten Schedule
  - Zeile 134-158: Gruppenphase mit Fair Scheduler
  - Zeile 162-214: Finalrunde schedulen (mit durchgehender matchNumber!)
  - Zeile 236-254: **Berechnung startMatchNumber** für Finalrunde
  - Zeile 263-265: **Schiedsrichter-Zuweisung** über assignReferees()
  - Zeile 268-269: Split back into group stage and finals (mit referee assignments)
  - Zeile 271-330: Erstellt Phasen (groupStage, roundOf16, quarterfinal, semifinal, final)
- `scheduleMatches(matches, startTime, ..., startMatchNumber)` - Weist Uhrzeiten zu
  - Zeile 384: **matchNumber beginnt bei startMatchNumber** (nicht mehr bei 1!)
  - Zeile 373-444: Sortiert Matches nach Slot, gruppiert nach Slot, scheduliert jeden Slot
- `resolveTeamName(teamId, teamMap, locale)` - Übersetzt Team-IDs
  - Zeile 486-495: Prüft teamMap, sonst translatePlaceholder
- `translatePlaceholder(placeholder, locale)` - Übersetzt Playoff-Platzhalter
  - Zeile 500-628: **Übersetzungstabelle DE/EN**
  - Unterstützt: group-x-1st, semi1-winner, semi1-loser, qf1-winner, r16-1-winner

**Wichtige Übersetzungen (Deutsch):**
- `'semi1-winner'` → `'Sieger HF 1'`
- `'semi1-loser'` → `'Verlierer HF 1'`
- `'qf1-winner'` → `'Sieger VF 1'`
- `'r16-1-winner'` → `'Sieger AF 1'`

**Return Type:**
```typescript
GeneratedSchedule {
  tournament: { id, title, date, location, ageClass },
  allMatches: ScheduledMatch[],
  phases: SchedulePhase[],
  startTime: Date,
  endTime: Date,
  totalDuration: number,
  numberOfFields: number,
  teams: Array<{ id, name, group? }>,
  initialStandings: Standing[],
  refereeConfig?: RefereeConfig
}
```

---

### `/src/lib/pdfExporter.ts` - PDF Export (KOMPLETT NEU)
**Zweck**: Generiert druckfertigen PDF-Spielplan mit HTML-basiertem Layout

**Architektur:**
- Basiert auf HTML-Referenz-Layout
- A4 Portrait (210mm × 297mm)
- Margins: 14mm top, 16mm bottom, 16mm left/right
- Grayscale-Farben: border (#e5e7eb), headBg (#f9fafb), textMain (#111827), textMuted (#6b7280)
- Modularer Aufbau mit separaten Render-Funktionen

**Hauptfunktion:**
- `exportScheduleToPDF(schedule, standings?, options)` - Zeile 129-206
  - Parameter: GeneratedSchedule, Standing[] | undefined, PDFExportOptions
  - Options: locale, includeStandings, organizerName, hallName
  - Erstellt PDF mit allen Sektionen

**Render-Funktionen:**
1. `renderHeader(doc, schedule, yPos)` - Zeile 215-237
   - **Dynamischer Titel**: schedule.tournament.title (zentriert)
   - Untertitel: schedule.tournament.ageClass

2. `renderMetaBox(doc, schedule, t, organizerName, hallName, yPos)` - Zeile 247-358
   - **2-Spalten Layout** mit einzelnem abgerundeten Rahmen
   - Linke Spalte: Veranstalter, Halle, Spieltag, Zeit
   - Rechte Spalte: Modus, Spielzeit, Pause
   - Labels dynamisch mit ":" versehen (Zeile 342, 359)
   - Automatische Label-Breiten-Berechnung für Ausrichtung

3. `renderHints(doc, t, yPos)` - Zeile 363-376
   - Nur Ergebniseintragung-Hinweis (SR-Erklärung entfernt)

4. `renderParticipants(doc, schedule, t, yPos)` - Zeile 382-523
   - **Spezialfall für 1 Gruppe** (Zeile 421-448): Volle Breite, kein Gruppentitel
   - **Multi-Gruppe** (Zeile 450-519): 2 Gruppen nebeneinander in Boxen
   - **Kontinuierliche Team-Nummerierung** (Zeile 418, 429): 1, 2, 3... über alle Gruppen
   - Alphabetische Sortierung innerhalb Gruppen (Zeile 409)
   - Gruppen alphabetisch sortiert (Zeile 411)

5. `renderGroupStage(doc, matches, hasGroups, t, refereeConfig, numberOfFields, yPos)` - Zeile 528-620
   - Vorrunde-Tabelle: Nr | Zeit | Feld (optional) | Gr (optional) | Heim | Ergebnis | Gast | SR (optional)
   - Feld-Spalte nur bei numberOfFields > 1 (Zeile 552)
   - Gruppen-Spalte nur bei mehreren Gruppen (Zeile 541-542)

6. `renderFinalsSection(doc, phases, t, refereeConfig, numberOfFields, yPos)` - Zeile 626-684
   - Phasentitel linksbündig (Zeile 642)
   - Sortiert Matches nach matchNumber (Zeile 646)
   - Gruppiert aufeinanderfolgende Matches mit gleichem finalType (Zeile 649-675)
   - Separate Sub-Tabellen für Platzierungsspiele (Platz 3, 5, 7)

7. `renderFinalsTable(doc, matches, t, refereeConfig, numberOfFields, yPos, subtitle?)` - Zeile 710-800
   - Optional Subtitle für Platzierungsspiele (Zeile 722-729)
   - Nr | Zeit | Feld (optional) | Heim | Ergebnis | Gast | SR (optional)
   - Dynamische Column-Styles basierend auf numberOfFields

8. `renderGroupStandings(doc, schedule, standings, t, yPos)` - Zeile 805-908
   - Separate Tabelle pro Gruppe
   - Format: "Tabelle – Gruppe X"
   - Pl | Team | Sp | S | U | N | Tore | Diff | Pkt
   - 4mm zusätzlicher Abstand zwischen Gruppen (Zeile 903)

**PDF Style Configuration:**
```typescript
PDF_STYLE = {
  colors: { border, borderDark, headBg, textMain, textMuted, white },
  fonts: { h1: 18, h2: 15, meta: 11, sectionTitle: 13, table: 12, hint: 10 },
  spacing: { pageMargin: {top:14, bottom:16, left:16, right:16}, sectionGap: 6, blockGap: 4 }
}
```

**Translations:**
- Deutsche Übersetzungen in TRANSLATIONS.de
- Struktur für zukünftige Internationalisierung vorbereitet

**Integration:**
- Aufgerufen in TournamentPreview.tsx Zeile 128-135
- Parameter: schedule, schedule.initialStandings, { locale, includeStandings, organizerName, hallName }

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

---

### `/src/utils/calculations.ts` - Tabellen-Berechnung & Platzierungslogik
**Zweck**: Berechnet Standings und sortiert nach Platzierungskriterien

**Wichtige Funktionen:**
- `calculateStandings(teams, matches, tournament, group?)` - Zeile 6-73
  - Berechnet Punkte, Tore, Tordifferenz für alle Teams
  - Filtert Matches für spezifische Gruppe oder alle Spiele (ohne Finals)
  - Sortiert mit `sortByPlacementLogic()`

- `sortByPlacementLogic(standings, placementLogic, matches?)` - Zeile 78-123
  - Sortiert nach aktivierten Kriterien in Reihenfolge
  - Unterstützt: points, goalDifference, goalsFor, goalsAgainst, wins, directComparison
  - Zeile 101-109: **directComparison** nur wenn alle vorherigen Kriterien gleich

- `compareDirectMatches(a, b, matches)` - Zeile 130-209
  - **Direkter Vergleich** (Mini-Tabelle aus direkten Begegnungen)
  - Fixe Kriterien-Reihenfolge:
    1. Punkte aus direkten Spielen
    2. Tordifferenz aus direkten Spielen
    3. Geschossene Tore aus direkten Spielen
  - Zeile 136-145: Findet alle direkten Matches zwischen zwei Teams
  - Zeile 157-184: Berechnet Mini-Tabelle Stats
  - Zeile 187-206: Vergleicht nach fixer Reihenfolge

- `getQualifiedTeams(standings, count)` - Zeile 210-212
  - Gibt Top N Teams aus Standings zurück

**Platzierungs-Kriterien:**
```typescript
PlacementCriterion {
  id: 'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'wins' | 'directComparison',
  label: string,
  enabled: boolean
}
```

---

### `/src/utils/fairScheduler.ts` - Faire Spielplan-Verteilung
**Zweck**: Generiert fairen Spielplan mit optimaler Feld- und Zeit-Verteilung

**Wichtige Funktionen:**
- `generateGroupPhaseSchedule(options)` - Hauptfunktion
  - Parameter: groups, numberOfFields, slotDurationMinutes, breakBetweenSlotsMinutes, minRestSlotsPerTeam, startTime
  - Generiert Matches mit optimaler Verteilung
  - Slot-basiertes System für faire Pausen

**Algorithmus:**
1. Generiert Round-Robin Matches pro Gruppe
2. Verteilt Matches auf Slots mit fairen Pausen
3. Respektiert minRestSlotsPerTeam Constraint
4. Optimiert Feld-Auslastung

---

### `/src/components/ScheduleDisplay.tsx` - Haupt-Display-Komponente
**Zweck**: Zeigt kompletten Spielplan mit allen Phasen

**Props:**
- `schedule: GeneratedSchedule` - Kompletter Schedule
- `currentStandings?: Standing[]` - Optionale aktuelle Tabelle
- `showQRCode?: boolean` - QR-Code für Live-Tracking
- `qrCodeUrl?: string` - QR-Code URL
- `logoUrl?: string` - Logo URL
- `editable?: boolean` - Ermöglicht SR/Feld-Änderung
- `onRefereeChange?: (matchId, refereeNumber) => void` - Callback für SR-Änderungen
- `onFieldChange?: (matchId, fieldNumber) => void` - Callback für Feld-Änderungen

**Komponenten:**
- Zeile 73-77: TournamentHeader
- Zeile 80-85: ParticipantsAndGroups (nur bei Gruppenturnieren)
- Zeile 88-98: GroupStageSchedule
- Zeile 101-107: GroupTables
- Zeile 109-119: FinalStageSchedule

**Editable Mode:**
- Props werden an Child-Components durchgereicht
- onRefereeChange und onFieldChange werden an GroupStageSchedule/FinalStageSchedule übergeben

---

### `/src/components/schedule/ParticipantsAndGroups.tsx` - Teilnehmer-Anzeige
**Zweck**: Zeigt Teams nach Gruppen organisiert mit kontinuierlicher Nummerierung

**Wichtige Features:**
- Zeile 24-34: **Kontinuierliche Team-Nummerierung** über alle Gruppen hinweg
  - Erstellt teamNumberMap mit fortlaufenden Nummern (1, 2, 3...)
  - Wichtig für "Teams stellen Schiedsrichter" Modus (Team-Nummer = SR-Nummer)
- Zeile 80-81: **Spezialfall einzelne Gruppe** - Gruppentitel wird ausgeblendet
- Zeile 89: Gruppentitel nur anzeigen wenn showGroupTitles = true
- Zeile 115-131: `getGroupStandings()` Funktion
  - Zeile 122: Gruppen alphabetisch sortiert
  - Zeile 130: Teams alphabetisch innerhalb Gruppe sortiert
  - **Wichtig**: Sortierung muss mit PDF-Export übereinstimmen!

**Team-Nummerierung Logik:**
```typescript
// 1. Gruppen alphabetisch sortieren (A, B, C...)
// 2. Teams innerhalb Gruppe alphabetisch sortieren
// 3. Durchgehende Nummerierung: Gruppe A (1-5), Gruppe B (6-10)...
// → Identisch mit PDF-Export für konsistente SR-Nummern
```

---

### `/src/components/schedule/GroupStageSchedule.tsx` - Gruppenphase-Tabelle
**Zweck**: Zeigt Gruppenphase-Spiele mit optionaler SR/Feld-Bearbeitung

**Wichtige Features:**
- Zeile 33-34: `showReferees` und `showFields` basierend auf Config
- Zeile 36-58: Dropdown-Optionen für SR und Felder
- Zeile 60-82: **Feld-Konflikt-Erkennung** (findFieldConflict)
  - Prüft zeitliche Überschneidungen auf gleichem Feld
  - Zeile 75-77: Overlap-Logik: `(start1 < end2) AND (start2 < end1)`
- Zeile 98-133: SR-Spalte mit editierbarem Dropdown oder statischer Anzeige
- Zeile 143-187: Feld-Spalte mit editierbarem Dropdown und Konflikt-Warnung
  - Zeile 150-159: window.confirm() bei Zeitkonflikt

**Tabellen-Struktur:**
- Nr | SR (optional) | Zeit | Gr (optional) | Heim | Ergebnis | Gast | Feld (optional)

**Editable Mode:**
- Native `<select>` Dropdowns für direkte Änderung
- Zeile 100-126: SR-Dropdown mit onChange-Handler
- Zeile 145-181: Feld-Dropdown mit Konflikt-Prüfung

---

### `/src/components/schedule/FinalStageSchedule.tsx` - Finalrunden-Tabelle
**Zweck**: Zeigt Finalrunden-Spiele mit optionaler SR/Feld-Bearbeitung

**Wichtige Features:**
- Zeile 31-32: `showReferees` und `showFields` basierend auf Config
- Zeile 34-56: Dropdown-Optionen für SR und Felder
- Zeile 58-80: **Feld-Konflikt-Erkennung** (identisch zu GroupStageSchedule)
- Zeile 97-132: SR-Spalte mit editierbarem Dropdown
- Zeile 143-187: Feld-Spalte mit Konflikt-Warnung
- Zeile 134-141: Spiel-Label mit Team-Namen
  - Format: "Halbfinale" (Label) + "Team A - Team B" (Teams)

**Tabellen-Struktur:**
- Nr | SR (optional) | Zeit | Spiel | Ergebnis | Feld (optional)

**getFinalMatchLabel(match):**
- Zeile 131-157: Bestimmt Spiel-Label basierend auf finalType und phase
- Finale: 🏆 Finale, Platz 3: 🥉, Platz 5/7: Text

---

### `/src/components/RefereeAssignmentEditor.tsx` - Manuelle SR-Zuweisung
**Zweck**: Alternative UI für manuelle SR-Zuweisung mit Drag & Drop

**Wichtige Funktionen:**
- `findOverlappingConflict(matches, targetMatchId, refereeNumber)` - Zeile 21-47
  - Prüft zeitliche Konflikte (SR bereits bei anderem Spiel zur gleichen Zeit)
  - Zeile 34-42: Zeit-Overlap-Logik
  - Gibt konfligierendes Match oder null zurück

**Komponenten:**
- Zeile 270-297: Draggable Referee Cards (nur Organizer-Modus)
- Zeile 304-358: Matches-Liste mit Dropzones und Select
- Zeile 324-355: Dropdown mit Konflikt-Prüfung

**Konflikt-Behandlung:**
- Zeile 136-155: Drag & Drop - window.confirm() bei Zeitkonflikt
- Zeile 332-348: Dropdown - window.confirm() bei Zeitkonflikt
- User kann Konflikt überschreiben (manuell hat Vorrang)

---

### `/src/features/tournament-creation/TournamentPreview.tsx` - Vorschau & Bearbeitung
**Zweck**: Zeigt Turnier-Vorschau mit Bearbeitungsmöglichkeit

**Wichtige Funktionen:**
- Zeile 51-82: `handleRefereeAssignment(matchId, refereeNumber)` - SR-Änderung
  - Aktualisiert manualAssignments
  - Regeneriert Schedule
  - Notifiziert Parent-Component

- Zeile 106-126: `handleFieldChange(matchId, fieldNumber)` - Feld-Änderung
  - Aktualisiert fieldAssignments
  - Regeneriert Schedule
  - Notifiziert Parent-Component

- Zeile 128-135: `handleExportPDF()` - PDF Export
  - Ruft exportScheduleToPDF() auf
  - Übergibt schedule, standings, options

**Props an ScheduleDisplay:**
- Zeile 354-359: editable={true}, onRefereeChange, onFieldChange
- Ermöglicht direkte SR/Feld-Änderung in Tabellen

---

### `/src/features/tournament-creation/Step2_ModeAndSystem.tsx` - Turnier-Konfiguration
**Zweck**: Konfiguration von Modus, Gruppen, Finalrunden, Schiedsrichtern, Feldern

**Wichtige Sektionen:**
1. Zeile 50-150: Gruppen-Konfiguration
2. Zeile 152-250: Finalrunden-Konfiguration (finalsConfig)
3. Zeile 252-350: Schiedsrichter-Konfiguration (refereeConfig)
4. Zeile 352-400: Feld-Anzahl und weitere Einstellungen

**Finals Config:**
- Preset-Auswahl: none, final-only, top-4, top-8, top-16, all-places
- Parallel-Optionen: parallelSemifinals, parallelQuarterfinals, parallelRoundOf16

**Referee Config:**
- Mode-Auswahl: none, organizer, teams
- Organizer-Modus: numberOfReferees, maxConsecutiveMatches
- Finals-Referee-Mode: none, neutralTeams, nonParticipatingTeams

---

## 🔄 Datenfluss: Komplett

```
1. User konfiguriert Turnier in Step2_ModeAndSystem.tsx
   ↓ finalsConfig: { preset: 'top-4', parallelSemifinals: true }
   ↓ refereeConfig: { mode: 'organizer', numberOfReferees: 3, maxConsecutiveMatches: 1 }
   ↓ numberOfFields: 2

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
   ↓ startTime, endTime = berechnet

6. scheduleGenerator: assignReferees()
   ↓ refereeAssigner.assignReferees(allMatches, teams, refereeConfig)
   ↓ Weist SR-Nummern zu: match.referee = 1, 2, 3...
   ↓ Respektiert manualAssignments

7. TournamentPreview.tsx
   ↓ Zeigt ScheduleDisplay mit editable=true
   ↓ Passes onRefereeChange={handleRefereeAssignment}
   ↓ Passes onFieldChange={handleFieldChange}

8. ScheduleDisplay → GroupStageSchedule / FinalStageSchedule
   ↓ Props: editable, onRefereeChange, onFieldChange werden durchgereicht
   ↓ SR-Spalte als zweite Spalte (nach Nr.)
   ↓ Feld-Spalte als letzte Spalte (wenn numberOfFields > 1)

9. User ändert SR/Feld in Tabelle
   ↓ Dropdown onChange → onRefereeChange(matchId, refereeNumber)
   ↓ Dropdown onChange → onFieldChange(matchId, fieldNumber)
   ↓ Konflikt-Prüfung bei Feld-Änderung
   ↓ TournamentPreview: regeneriert Schedule mit neuer Zuweisung

10. User exportiert PDF
   ↓ handleExportPDF() → exportScheduleToPDF(schedule, standings, options)
   ↓ Rendert Header (dynamisch: tournament.title + ageClass)
   ↓ Rendert Meta-Box (4-Spalten Grid)
   ↓ Rendert Hints
   ↓ Rendert Participants (globale Nummerierung)
   ↓ Rendert GroupStage Table
   ↓ Rendert Group Standings (2-Spalten)
   ↓ Rendert Finals Tables (separate Tabellen pro Phase)
   ↓ Speichert PDF: {tournament.title}_Spielplan.pdf
```

---

## 🎯 Häufige Änderungen & wo sie gemacht werden

### PDF-Layout ändern
**Datei**: `/src/lib/pdfExporter.ts`
- Zeile 23-53: PDF_STYLE - Farben, Fonts, Spacing
- Zeile 196-218: renderHeader() - Header-Layout
- Zeile 220-308: renderMetaBox() - Meta-Box Layout
- Zeile 341-411: renderParticipants() - Teilnehmer-Layout
- Zeile 413-497: renderGroupStage() - Vorrunde-Tabelle
- Zeile 626-735: renderGroupStandings() - Tabellen-Layout

### Team-Nummerierung ändern
**Datei**: `/src/lib/pdfExporter.ts`, Zeile 355-360
```typescript
// Globale Team-Nummerierung
const teamNumbers = new Map<string, number>();
let globalNumber = 1;
schedule.teams.forEach(team => {
  teamNumbers.set(team.id, globalNumber++);
});
```

### Platzierungskriterien ändern
**Datei**: `/src/utils/calculations.ts`
- Zeile 78-123: sortByPlacementLogic() - Kriterien-Reihenfolge
- Zeile 130-209: compareDirectMatches() - Direkter Vergleich Logik
- Zeile 90-110: Switch über criterion.id - Neue Kriterien hinzufügen

### Feld-Konflikt-Logik ändern
**Dateien**:
- `/src/components/schedule/GroupStageSchedule.tsx` - Zeile 60-82
- `/src/components/schedule/FinalStageSchedule.tsx` - Zeile 58-80
- Overlap-Prüfung: `(start1 < end2) AND (start2 < end1)`

### SR-Anzeige in PDF ändern
**Datei**: `/src/lib/pdfExporter.ts`
- Zeile 438-441: Header-Row mit SR-Spalte
- Zeile 455-457: Data-Row mit SR-Nummer oder '-'
- Zeile 488: columnStyles für SR-Spalte

### Neue Playoff-Runde hinzufügen
1. **tournament.ts**: Erweitere `FinalsPreset` um `'top-32'`
2. **playoffGenerator.ts**: Erstelle `generateTop32()` Funktion
3. **finalsOptions.ts**: Füge Top-32 zu `getFinalsOptions()` hinzu
4. **scheduleGenerator.ts**: Erweitere `translatePlaceholder()` um r32-x-winner/loser
5. **playoffScheduler.ts**: Erweitere parallelMode Detection

---

## 🐛 Debugging-Tipps

### Problem: PDF-Export funktioniert nicht
**Check**: Browser Console für Fehler
**Check**: `exportScheduleToPDF` wird mit korrekten Parametern aufgerufen (TournamentPreview.tsx Zeile 129)
**Check**: schedule.tournament.title ist gesetzt

### Problem: Team-Nummerierung falsch
**Check**: pdfExporter.ts Zeile 355-360 - Globale Nummerierung
**Check**: Reihenfolge von schedule.teams

### Problem: Tabellen sortieren nicht korrekt
**Check**: calculations.ts Zeile 78-123 - placementLogic
**Check**: tournament.placementLogic enthält korrekte Kriterien mit enabled: true
**Check**: compareDirectMatches() wird korrekt aufgerufen

### Problem: Feld-Konflikte werden nicht erkannt
**Check**: findFieldConflict() in GroupStageSchedule.tsx Zeile 60-82
**Check**: match.startTime und match.endTime sind korrekt gesetzt
**Check**: Overlap-Logik: `(targetStart < matchEnd && matchStart < targetEnd)`

### Problem: SR-Spalte wird nicht angezeigt
**Check**: schedule.refereeConfig wird korrekt durchgereicht
**Check**: `showReferees = refereeConfig && refereeConfig.mode !== 'none'`
**Check**: Props werden an GroupStageSchedule/FinalStageSchedule übergeben

### Problem: Feld-Spalte wird nicht angezeigt
**Check**: `showFields = numberOfFields > 1`
**Check**: schedule.numberOfFields ist > 1
**Check**: Props werden korrekt durchgereicht

### Problem: Manuelle Zuweisungen funktionieren nicht
**Check**: onRefereeChange und onFieldChange Callbacks sind definiert
**Check**: TournamentPreview.tsx regeneriert Schedule nach Änderung
**Check**: manualAssignments und fieldAssignments werden korrekt aktualisiert

### Problem: "semi1-loser" wird nicht übersetzt
**Check**: scheduleGenerator.ts Zeile 500-628 - Übersetzungstabelle
**Check**: Platzhalter ist in TRANSLATIONS.de vorhanden

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

### Placement Criteria IDs
```typescript
'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'wins' | 'directComparison'
```

### Referee Modes
```typescript
RefereeMode: 'none' | 'organizer' | 'teams'
FinalsRefereeMode: 'none' | 'neutralTeams' | 'nonParticipatingTeams'
```

### PDF Style Constants
```typescript
PDF_STYLE.colors: border, borderDark, headBg, textMain, textMuted, white
PDF_STYLE.fonts: h1, h2, meta, sectionTitle, phaseTitle, groupTitle, table, hint
PDF_STYLE.spacing: pageMargin, sectionGap, blockGap
```

---

## 📝 Implementierte Features

### ✅ Core Features
- Tournament Creation Flow (4 Steps)
- Fair Scheduler mit Slot-basiertem System
- Playoff-System mit Presets (none, final-only, top-4, top-8, top-16, all-places)
- Schiedsrichter-System (Organizer + Teams Modus)
- Feld-Verwaltung mit Konflikt-Erkennung
- Platzierungs-Logik mit konfigurierbaren Kriterien
- Direkter Vergleich (Head-to-Head)

### ✅ PDF Export (Komplett neu)
- HTML-basiertes Layout
- Dynamischer Header (Turniername aus Stammdaten)
- 4-Spalten Meta-Box
- Globale Team-Nummerierung (1-10)
- Separate Tabellen pro Finalrunden-Phase
- 2-Spalten Gruppen-Tabellen Layout
- "Tabelle – Gruppe X" Format
- SR-Spalte (optional)
- A4 Portrait, Grayscale-optimiert

### ✅ Manuelle Bearbeitung
- SR-Zuweisung via Dropdown in Tabellen
- Feld-Zuweisung via Dropdown in Tabellen
- Zeitliche Konflikt-Erkennung
- User-Bestätigung bei Konflikten
- Automatische Schedule-Regenerierung
- RefereeAssignmentEditor mit Drag & Drop

### ✅ Display Features
- Responsive Tabellen-Ansicht
- Editable Mode für Vorschau
- SR-Spalte (dynamisch basierend auf Config)
- Feld-Spalte (dynamisch basierend auf numberOfFields)
- Gruppierte Teilnehmer-Anzeige
- Gruppen-Tabellen mit Live-Berechnung

---

## 🔗 Wichtigste Abhängigkeiten

```
Tournament Creation
  ↓
Step2_ModeAndSystem
  ↓ finalsConfig, refereeConfig, numberOfFields, fieldAssignments
  ↓
TournamentPreview
  ↓ generateFullSchedule()
    ↓ fairScheduler.generateGroupPhaseSchedule()
    ↓ playoffScheduler.generatePlayoffSchedule()
    ↓ scheduleGenerator.scheduleMatches()
    ↓ refereeAssigner.assignReferees()
  ↓ ScheduleDisplay (editable mode)
    ↓ GroupStageSchedule (SR/Feld-Dropdowns)
    ↓ FinalStageSchedule (SR/Feld-Dropdowns)
    ↓ GroupTables (calculations.calculateStandings)
  ↓ RefereeAssignmentEditor
  ↓ handleExportPDF()
    ↓ pdfExporter.exportScheduleToPDF()
      ↓ renderHeader()
      ↓ renderMetaBox()
      ↓ renderParticipants()
      ↓ renderGroupStage()
      ↓ renderGroupStandings()
      ↓ renderFinalsSection()
```

---

**Last Updated**: 2025-11-28
**Version**: 2.0 (PDF Export + Feld-Management + Platzierungs-Logik)
