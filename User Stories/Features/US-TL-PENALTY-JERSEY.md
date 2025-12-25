# US-TL-PENALTY-JERSEY: Trikotnummer bei Strafen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TL-PENALTY-JERSEY |
| **Priorität** | Medium |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Live-Steuerung |
| **Impact** | Niedrig |

---

## User Story

**Als** Mitglied der Turnierleitung
**möchte ich** bei der Vergabe von persönlichen Strafen optional eine Trikotnummer angeben können
**damit** ich bei Bedarf nachvollziehen kann, welcher Spieler die Strafe erhalten hat, ohne den Standardablauf zu verlangsamen

---

## Kontext

Manche Turniere wollen Strafen auf Spielerebene nachvollziehen, andere nicht. Die Trikotnummer-Erfassung ist daher ein optionales Feature, das pro Turnier aktiviert werden kann.

---

## Acceptance Criteria

### Turnier-Einstellung

1. **AC1:** Given ein Turnier ist angelegt, When ich die Turnier-Einstellungen öffne, Then sehe ich eine Option wie 'Trikotnummern bei persönlichen Strafen erfassen' (Boolean-Einstellung auf Turnier-Ebene).

### Deaktiviert (Standard)

2. **AC2:** Given die Option ist DEAKTIVIERT, When ich im Reiter 'Turnierleitung' persönliche Strafen vergebe, Then erscheint keine Eingabemöglichkeit für Trikotnummern und der Ablauf entspricht exakt dem bisherigen Verhalten.

### Aktiviert

3. **AC3:** Given die Option ist AKTIVIERT, When ich im Reiter 'Turnierleitung' unter einem Team die Buttons für persönliche Strafen sehe, Then ist ein optionales Eingabefeld für eine Trikotnummer sichtbar.

4. **AC4:** Given die Option ist AKTIVIERT, When ich eine persönliche Strafe vergebe UND eine Trikotnummer eingetragen habe, Then wird im erzeugten Straf-Event zusätzlich die Trikotnummer gespeichert.

5. **AC5:** Given die Option ist AKTIVIERT, When ich eine persönliche Strafe vergebe OHNE Trikotnummer, Then wird die Strafe wie gewohnt erzeugt (ohne Trikotnummer), keine Fehlermeldung.

### Anzeige

6. **AC6:** Given eine Strafe wurde mit Trikotnummer erfasst, When ich mir die Strafen ansehe, Then wird die Trikotnummer angezeigt (z.B. '#7').

7. **AC7:** Given eine Strafe wurde OHNE Trikotnummer erfasst, When ich mir die Strafen ansehe, Then wird die Strafe ohne Trikotnummer dargestellt (keine leeren Platzhalter).

### Nachträgliche Deaktivierung

8. **AC8:** Given die Option wird später deaktiviert, When ich neue Strafen vergebe, Then kann ich keine Trikotnummer mehr eingeben, aber bereits gespeicherte Strafen mit Trikotnummer behalten ihre Werte.

### Performance

9. **AC9:** Given ich nutze die Trikotnummern-Funktion NICHT, When ich Strafen vergebe, Then bleibt der Ablauf (Anzahl Klicks, Geschwindigkeit) unverändert.

---

## UX-Hinweise

- Eingabefeld für Trikotnummer als kleines, diskretes '#'-Feld direkt neben den Straf-Buttons
- Trikotnummernfeld klar als 'optional' kennzeichnen
- In der Darstellung der Strafzeiten die Trikotnummer kompakt integrieren
- Bei mehreren aktiven Strafzeiten die Trikotnummern in der Liste mitführen

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | Live-Steuerung Features |
