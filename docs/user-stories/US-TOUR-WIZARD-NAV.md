# US-TOUR-WIZARD-NAV: Wizard-Navigation mit Auto-Save

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOUR-WIZARD-NAV |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Turnier-Management |
| **Impact** | Mittel |

---

## User Story

**Als** Benutzer, der ein neues Turnier erstellt
**möchte ich** über die Screenbar zwischen den einzelnen Screens navigieren können
**damit** ich den Fortschritt überblicke, gezielt Informationen korrigieren und nahtlos fortsetzen kann, ohne meinen Input zu verlieren

---

## Kontext

Der Turnier-Erstellungswizard besteht aus mehreren Screens (Grunddaten, Teams, Spielmodus, Spielplan). Benutzer sollen frei zwischen diesen navigieren können, wobei Eingaben automatisch gespeichert werden.

---

## Acceptance Criteria

### Navigation

1. **AC1:** Given ich befinde mich im Turnier-Erstellungswizard, When der Wizard in einem Screen geöffnet ist, Then sehe ich am oberen Rand alle Screens des Wizards (z.B. 'Grunddaten', 'Teams', 'Spielmodus', 'Spielplan') in einer horizontalen Navigation.

2. **AC2:** Given die Screenbar zeigt alle Screens an, When ich mich auf einem bestimmten Screen befinde, Then ist der aktuelle Screen visuell hervorgehoben.

### Auto-Save

3. **AC3:** Given ich befinde mich auf einem Screen, When ich Daten eingegeben habe und einen anderen Screen über die Screenbar anklicke, Then werden alle Eingaben im aktuellen Screen automatisch gespeichert.

### Validierung

4. **AC4:** Given ein Screen enthält ungültige Eingaben, When ich versuche über die Screenbar zu navigieren, Then wird eine kurze Validierungsmeldung angezeigt und die Navigation wird NICHT durchgeführt.

5. **AC5:** Given ein Screen enthält unvollständige Eingaben, When ich navigieren möchte, Then erhalte ich eine OPTIONALE Bestätigungsabfrage ('Einige Felder sind noch nicht vollständig. Trotzdem fortfahren?').

### Datenpersistenz

6. **AC6:** Given ich kehre zu einem zuvor besuchten Screen zurück, When der Screen geladen ist, Then werden alle zuvor eingegebenen und gespeicherten Daten korrekt wiederhergestellt.

7. **AC7:** Given ich habe den Wizard zwischenzeitlich geschlossen, When ich den Wizard später erneut öffne, Then wird der zuletzt besuchte Screen geöffnet und alle Eingaben sind vorhanden.

### Smooth Transitions

8. **AC8:** Given ich befinde mich im Wizard, When ich von einem Screen zu einem anderen navigiere, Then erfolgt der Wechsel ohne vollständiges Neuladen der Seite (Single-Page-Verhalten).

---

## UX-Hinweise

- Screenbar optisch klar vom Wizard-Content abgrenzen (kontrastierende Hintergrundfarbe)
- Bereits besuchte Screens mit einem Haken oder anderem Farbton markieren
- Bei Validierungsfehlern den Screen-Link mit rotem Symbol versehen
- Fortschrittsbalken unterhalb der Screenbar anzeigen ('2 von 4 Screens abgeschlossen')
- Auto-Save-Bestätigungen dezent anzeigen (kleines 'Gespeichert' in der Ecke)
- Optional: 'Zurück'- und 'Weiter'-Buttons zusätzlich zur Screenbar anbieten

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | Turnier-Erstellung Features |
