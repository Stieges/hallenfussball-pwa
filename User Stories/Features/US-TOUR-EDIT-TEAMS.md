# US-TOUR-EDIT-TEAMS: Teams bearbeiten

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOUR-EDIT-TEAMS |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-20 |
| **Kategorie** | Turnier-Management |
| **Impact** | Hoch |

---

## User Story

**Als** Turnier-Owner oder -Organisator
**möchte ich** Teams eines veröffentlichten Turniers umbenennen, hinzufügen oder entfernen können
**damit** ich Teamdaten korrigieren kann, wobei ich bei vorhandenen Ergebnissen gewarnt werde

---

## Kontext

Team-Änderungen können Auswirkungen auf bestehende Ergebnisse haben. Daher werden Warnungen angezeigt, wenn Teams mit Ergebnissen bearbeitet werden.

---

## Acceptance Criteria

### Ohne Ergebnisse

1. **AC1:** Given ein Turnier ohne Ergebnisse, When ich Teams hinzufüge, umbenenne oder entferne, Then werden die Änderungen ohne Warnung übernommen und der Spielplan wird neu generiert.

### Team umbenennen (mit Ergebnissen)

2. **AC2:** Given ein Team hat bereits gespielte Matches mit Ergebnissen, When ich den Teamnamen ändere, Then erhalte ich eine Warnmeldung: 'Dieses Team hat bereits {n} Spiele mit Ergebnissen. Der neue Name wird in allen Spielen, Listen und PDFs angezeigt.'

3. **AC3:** Given die Warnmeldung für Teamumbenennung angezeigt wird, When ich 'Trotzdem ändern' bestätige, Then wird der Name überall aktualisiert.

4. **AC4:** Given die Warnmeldung für Teamumbenennung angezeigt wird, When ich 'Abbrechen' klicke, Then bleibt der ursprüngliche Name erhalten.

### Team löschen (mit Ergebnissen)

5. **AC5:** Given ein Team hat Matches MIT Ergebnissen, When ich versuche das Team zu löschen, Then werden nur die Matches OHNE Ergebnisse aus dem Spielplan entfernt. Die Matches mit Ergebnissen bleiben erhalten, aber das Team wird als 'entfernt' markiert.

6. **AC6:** Given ein Team wird gelöscht und hat Matches mit Ergebnissen, Then erhalte ich eine Warnmeldung: 'Team hat {n} Spiele mit Ergebnissen. Diese bleiben erhalten. {m} Spiele ohne Ergebnisse werden entfernt.'

7. **AC7:** Given ein Team hat NUR Matches OHNE Ergebnisse, When ich es lösche, Then wird das Team vollständig entfernt und alle zugehörigen Matches werden aus dem Spielplan gelöscht.

8. **AC8:** Given ein Team wurde als 'entfernt' markiert (hatte Ergebnisse), Then wird der Teamname in historischen Ergebnissen weiterhin angezeigt, aber visuell als entfernt gekennzeichnet (z.B. durchgestrichen oder mit Badge).

### Team hinzufügen

9. **AC9:** Given ich füge ein neues Team zu einem laufenden Turnier hinzu, When bereits Gruppenspiele stattgefunden haben, Then erhalte ich einen Hinweis: 'Das neue Team startet mit 0 Punkten. Der Spielplan muss manuell ergänzt werden.'

---

## UX-Hinweise

- Teams mit Ergebnissen visuell kennzeichnen (z.B. kleines Badge '3 Spiele')
- Warnmeldungen als modale Dialoge mit klaren Buttons: 'Trotzdem ändern' / 'Abbrechen'
- Bei Teamlöschung mit Ergebnissen Link zu 'Turnier zurücksetzen' anbieten
- Anzahl betroffener Spiele in der Warnung anzeigen

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Ersetzt** | TOUR-EDIT-01 (aufgeteilt) |
| **Verwandt** | US-TOUR-EDIT-META, US-TOUR-EDIT-STRUCTURE |
