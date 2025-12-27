# US-TOUR-EDIT-STRUCTURE: Turnierstruktur bearbeiten

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOUR-EDIT-STRUCTURE |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-20 |
| **Kategorie** | Turnier-Management |
| **Impact** | Hoch |

---

## User Story

**Als** Turnier-Owner oder -Organisator
**möchte ich** die Turnierstruktur (Modus, Gruppen, Finals) nur ändern können, wenn noch keine Ergebnisse vorliegen
**damit** versehentlicher Datenverlust durch implizite Löschung von Ergebnissen verhindert wird

---

## Kontext

Strukturänderungen sind "destruktive" Änderungen, die alle Ergebnisse invalidieren würden. Daher werden die Felder gesperrt, sobald Ergebnisse vorliegen. Ein expliziter "Turnier zurücksetzen"-Mechanismus ermöglicht trotzdem Änderungen.

---

## Acceptance Criteria

### Ohne Ergebnisse

1. **AC1:** Given ein Turnier ohne Ergebnisse, When ich Strukturparameter ändere (Anzahl Gruppen, Spielsystem, Finalrunden-Konfiguration), Then werden die Änderungen übernommen und der Spielplan wird neu generiert.

### Mit Ergebnissen (Read-Only)

2. **AC2:** Given ein Turnier mit mindestens einem Ergebnis, When ich die Struktureinstellungen öffne, Then sind alle strukturrelevanten Felder (Anzahl Gruppen, Spielsystem, Finalrunden-Preset) als read-only dargestellt.

3. **AC3:** Given strukturrelevante Felder sind read-only, Then wird ein Hinweistext angezeigt: 'Strukturänderungen sind nicht möglich, da bereits Ergebnisse vorliegen. Nutzen Sie Turnier zurücksetzen, um alle Ergebnisse zu löschen.'

### Turnier zurücksetzen

4. **AC4:** Given ich möchte die Struktur trotz vorhandener Ergebnisse ändern, When ich auf 'Turnier zurücksetzen' klicke, Then erhalte ich einen Bestätigungs-Dialog: 'Alle {n} Ergebnisse werden unwiderruflich gelöscht. Fortfahren?'

5. **AC5:** Given ich bestätige 'Turnier zurücksetzen', Then werden alle Ergebnisse gelöscht, das Turnier geht in den Zustand 'bereit' (keine Ergebnisse) und die Strukturfelder werden editierbar.

6. **AC6:** Given ich breche 'Turnier zurücksetzen' ab, Then bleiben alle Ergebnisse erhalten und die Strukturfelder bleiben read-only.

7. **AC7:** Given ein Turnier wird zurückgesetzt, Then wird ein Audit-Log-Eintrag erstellt: 'Turnier zurückgesetzt von [Benutzer] am [Datum]. {n} Ergebnisse gelöscht.'

---

## UX-Hinweise

- Read-only Strukturfelder visuell deutlich als gesperrt kennzeichnen (grauer Hintergrund, Schloss-Icon)
- 'Turnier zurücksetzen' als separaten, rot markierten Button im Einstellungsbereich platzieren
- Im Bestätigungsdialog die genaue Anzahl betroffener Ergebnisse anzeigen
- Nach dem Zurücksetzen eine Erfolgsmeldung anzeigen und automatisch zur Strukturbearbeitung navigieren
- Optional: Vor dem Zurücksetzen einen JSON/CSV-Export der aktuellen Ergebnisse anbieten

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Ersetzt** | TOUR-EDIT-01 (aufgeteilt) |
| **Verwandt** | US-TOUR-EDIT-META, US-TOUR-EDIT-TEAMS |
