# US-TOUR-EDIT-META: Turnier-Metadaten bearbeiten

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOUR-EDIT-META |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-20 |
| **Kategorie** | Turnier-Management |
| **Impact** | Mittel |

---

## User Story

**Als** Turnier-Owner oder -Organisator
**möchte ich** die Metadaten eines veröffentlichten Turniers jederzeit bearbeiten können
**damit** ich Informationen wie Titel, Ort, Veranstalter und Anstoßzeiten anpassen kann, ohne Ergebnisse zu gefährden

---

## Kontext

Metadaten-Änderungen sind "sichere" Änderungen, die keine Ergebnisse beeinflussen. Sie können jederzeit durchgeführt werden, ohne Warnungen oder Bestätigungen.

---

## Acceptance Criteria

### Basis-Funktionalität

1. **AC1:** Given ich habe ein veröffentlichtes Turnier, When ich die Einstellungen öffne, Then kann ich folgende Felder bearbeiten: Titel, Ort, Veranstalter, Datum, Startzeit, Kontaktinformationen.

2. **AC2:** Given ich ändere Metadaten eines Turniers mit Ergebnissen, When ich auf 'Speichern' klicke, Then werden die Änderungen ohne Warnung gespeichert, da sie keine Ergebnisse beeinflussen.

3. **AC3:** Given ich ändere die Anstoßzeiten einzelner Spiele, When ich speichere, Then werden nur die Zeiten aktualisiert, Ergebnisse und Struktur bleiben unverändert.

### Validierung & UX

4. **AC4:** Given ich bearbeite Metadaten, When ich die Seite verlasse ohne zu speichern, Then werde ich gewarnt, dass ungespeicherte Änderungen verloren gehen.

5. **AC5:** Given ich öffne die Metadaten erneut, When keine Änderungen vorgenommen wurden und ich 'Speichern' klicke, Then wird kein Schreibvorgang ausgelöst (Dirty-Form-Handling).

---

## UX-Hinweise

- Metadaten-Bearbeitung in einem eigenen 'Einstellungen'-Tab platzieren, getrennt vom Spielplan
- Speichern-Button nur aktivieren, wenn tatsächlich Änderungen vorgenommen wurden
- Erfolgreiche Speicherung mit dezenter Bestätigung anzeigen ('Gespeichert')

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Ersetzt** | TOUR-EDIT-01 (aufgeteilt) |
| **Verwandt** | US-TOUR-EDIT-TEAMS, US-TOUR-EDIT-STRUCTURE |
