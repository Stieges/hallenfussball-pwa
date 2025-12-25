# US-PUBLIC-HIGHLIGHT-CLUB: Verein im Spielplan hervorheben

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-PUBLIC-HIGHLIGHT-CLUB |
| **Priorität** | Medium |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Viewer |
| **Impact** | Mittel |

---

## User Story

**Als** Zuschauer
**möchte ich** einen Verein im Spielplan auswählen können
**damit** alle Spiele und Tabellenzeilen dieses Vereins hervorgehoben sind und ich seinen Turnierverlauf schneller erkennen kann

---

## Kontext

In größeren Turnieren mit vielen Teams ist es für Zuschauer schwer, alle Spiele eines bestimmten Teams zu finden. Mit der Hervorhebungs-Funktion können sie ihr Team auswählen und alle relevanten Einträge werden markiert.

---

## Acceptance Criteria

### Standard-Zustand

1. **AC1:** Given ich befinde mich in der öffentlichen Zuschauer-Ansicht eines Turniers, When ich mir den Spielplan oder eine Tabelle ansehe, Then werden alle Vereine zunächst einheitlich dargestellt (keine Hervorhebung).

### Auswahl

2. **AC2:** Given ich befinde mich in der öffentlichen Zuschauer-Ansicht, When ich auf einen Vereinsnamen tippe/klicke, Then wird dieser Verein als 'ausgewählt' gesetzt.

### Hervorhebung im Spielplan

3. **AC3:** Given ein Verein als 'ausgewählt' gesetzt wurde, When ich auf der Spielplan-Ansicht bin, Then werden alle Spiele dieses Vereins optisch hervorgehoben (Name fett, Zeile hervorgehoben).

### Hervorhebung in Tabellen

4. **AC4:** Given ein Verein als 'ausgewählt' gesetzt wurde, When ich auf die Tabellenansicht wechsle, Then werden alle Tabellenzeilen des Vereins ebenfalls hervorgehoben.

### Persistenz über Views

5. **AC5:** Given ein Verein als 'ausgewählt' gesetzt wurde, When ich zwischen Spielplan, Gruppen, Tabelle oder Finalrunde wechsle, Then bleibt die Auswahl bestehen und der Verein ist überall hervorgehoben.

### Toggle/Wechsel

6. **AC6:** Given ein Verein als 'ausgewählt' gesetzt wurde, When ich erneut auf denselben Verein tippe (Toggle), Then wird die Auswahl aufgehoben und alle Vereine werden wieder normal angezeigt.

7. **AC7:** Given ein Verein als 'ausgewählt' gesetzt wurde, When ich einen anderen Verein tippe, Then wird die Hervorhebung zum neu ausgewählten Verein gewechselt.

### Keine Störung des Standardverhaltens

8. **AC8:** Given kein Verein ausgewählt ist, When ich den Spielplan oder eine Tabelle anschaue, Then ändert sich die Darstellung nicht gegenüber dem bisherigen Verhalten.

### Kein Speichern

9. **AC9:** Given ein Verein ausgewählt ist, When ich die Seite aktualisiere, Then ist der Zustand wieder ohne Vereinsauswahl (keine Hervorhebung).

---

## UX-Hinweise

- Dezenter Hinweis einblenden: 'Tipp einen Verein an, um alle Spiele hervorzuheben'
- Vereinsname fett, gesamte Zeile leicht hinterlegt
- Optional: 'Favorit setzen'-Dropdown oberhalb des Spielplans
- Aktuell ausgewählten Verein in Badge anzeigen inkl. 'Auswahl zurücksetzen' Option
- Auf mobilen Geräten ausreichend große Touch-Targets

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | US-VIEWER-FILTERS |
