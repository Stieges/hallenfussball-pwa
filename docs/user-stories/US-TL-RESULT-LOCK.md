# US-TL-RESULT-LOCK: Ergebniskorrektur-Workflow

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TL-RESULT-LOCK |
| **Priorität** | High |
| **Status** | In Progress (80% Done) |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Live-Steuerung |
| **Impact** | Hoch |

---

## User Story

**Als** Mitglied der Turnierleitung
**möchte ich** dass ich das Ergebnis eines bereits beendeten Spiels nicht mehr direkt, sondern nur noch über einen expliziten Korrektur-Workflow ändern kann
**damit** Ergebnisänderungen nach Spielende bewusst, nachvollziehbar und weniger fehleranfällig erfolgen

---

## Kontext

Nach Spielende sollten Ergebnisse nicht mehr versehentlich geändert werden können. Ein expliziter Korrekturmodus schützt vor Fehlern und macht Änderungen nachvollziehbar.

---

## Acceptance Criteria

### Laufendes Spiel

1. **AC1:** Given ein Spiel hat den Status 'laufend', When ich im Reiter 'Turnierleitung' das Ergebnis erfasse oder ändere, Then kann ich die Tore wie gewohnt eingeben bzw. über Events erfassen.

### Beendetes Spiel (Read-Only)

2. **AC2:** Given ein Spiel wird regulär beendet (Status wird auf 'beendet' gesetzt), When ich anschließend den Reiter 'Turnierleitung' für dieses Spiel öffne, Then werden die Ergebnisfelder (Heim/Gast) nur noch als read-only angezeigt und die üblichen Live-Event-Buttons (Tor, Karte etc.) sind deaktiviert oder nicht mehr sichtbar.

3. **AC3:** Given ein Spiel hat den Status 'beendet', When ich den Reiter 'Turnierleitung' öffne, Then sehe ich einen Button 'Ergebnis korrigieren' in der Nähe der Ergebnisanzeige.

4. **AC4:** Given ein Spiel hat den Status 'beendet', When ich NICHT auf 'Ergebnis korrigieren' klicke, Then kann ich das Ergebnis an keiner Stelle direkt bearbeiten.

### Korrektur-Dialog

5. **AC5:** Given ein Spiel hat den Status 'beendet', When ich auf den Button 'Ergebnis korrigieren' klicke, Then öffnet sich ein Dialog/Modal mit einem Hinweistext, dass die Änderung des Ergebnisses Auswirkungen auf Tabellen, Platzierungen und eine ggf. vorhandene Finalphase haben kann.

6. **AC6:** Given der Dialog zur Ergebniskorrektur ist geöffnet, When ich auf 'Abbrechen' klicke, Then wird der Dialog geschlossen und das Spiel verbleibt im Zustand 'beendet' mit read-only Ergebnisanzeige.

7. **AC7:** Given der Dialog zur Ergebniskorrektur ist geöffnet, When ich auf 'Ergebnisbearbeitung starten' klicke, Then wird das Spiel in einen Korrekturmodus versetzt und ich kann die Ergebnisfelder wieder bearbeiten.

### Korrekturmodus

8. **AC8:** Given ich befinde mich im Korrekturmodus, When die Ansicht geladen ist, Then wird dies visuell erkennbar gemacht (z.B. Hinweisbanner 'Korrekturmodus – Änderungen werden protokolliert').

9. **AC9:** Given ich befinde mich im Korrekturmodus, When ich das Ergebnis ändere und auf einen Button 'Korrektur speichern' klicke, Then werden das neue Ergebnis und die Änderung persistent gespeichert und der Korrekturmodus wird wieder verlassen.

10. **AC10:** Given ich befinde mich im Korrekturmodus, When ich auf 'Korrektur abbrechen' klicke, Then werden alle seit Eintritt in den Korrekturmodus vorgenommenen Änderungen verworfen und das zuvor gespeicherte Endergebnis wiederhergestellt.

### Auswirkungen auf Tabellen

11. **AC11:** Given das geänderte Ergebnis kann Tabellen oder Finalpaarungen beeinflussen, When ich im Korrekturmodus auf 'Korrektur speichern' klicke, Then erhalte ich vor dem endgültigen Speichern eine Warnmeldung, dass Tabellen und ggf. Finalpaarungen anhand des neuen Ergebnisses neu berechnet werden und sich ändern können.

12. **AC12:** Given ich bestätige die Warnmeldung zur potentiellen Änderung von Tabellen/Finalpaarungen, When das Spiel gespeichert wird, Then werden alle abhängigen Tabellenstände und Finalpaarungen entsprechend der neuen Ergebnisse neu berechnet.

13. **AC13:** Given ich verwerfe die Warnmeldung, When der Speichervorgang abgebrochen wird, Then bleibt das zuvor gespeicherte Ergebnis unverändert.

14. **AC14:** Given eine Ergebniskorrektur wurde erfolgreich gespeichert, When ich später erneut den Reiter 'Turnierleitung' für dieses Spiel öffne, Then sehe ich das korrigierte Ergebnis sowie weiterhin die read-only Darstellung.

---

## UX-Hinweise

- Ergebnisfelder optisch klar von editierbaren Feldern absetzen (grauer Hintergrund, fehlende Input-Rahmen)
- Button 'Ergebnis korrigieren' visuell hervorheben, aber als sekundären Button
- Im Korrekturmodus auffälliges Banner oberhalb der Spielansicht einblenden
- Während des Korrekturmodus nur unbedingt notwendige Elemente editierbar machen
- Im Warn-Dialog Anzahl der betroffenen Tabellen- oder Finalspiele anzeigen
- Optional: Änderungsprotokoll pro Spiel darstellen ('Ergebnis am 15.12.2025 von 2:1 auf 2:2 geändert')
- Browser-Back-Button im aktiven Korrekturmodus mit Confirm-Dialog absichern

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | US-MON-LIVE-INDICATOR |
