# US-MON-TV-TIMER: Spielzeit-Anzeige auf Monitor

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MON-TV-TIMER |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Monitor |
| **Impact** | Sehr Hoch |

---

## User Story

**Als** Zuschauer in der Halle
**möchte ich** in der Monitor-Ansicht die aktuelle Spielzeit sehen
**damit** ich sofort sehen kann, wie weit das Spiel fortgeschritten ist und wann es endet

---

## Acceptance Criteria

### Zeit-Anzeige

1. **AC1:** Given ein Spiel läuft und die Monitor-Ansicht ist geöffnet, When das Spiel gestartet wurde, Then wird die aktuelle Spielzeit (z.B. '09:34') gut sichtbar angezeigt und läuft in Echtzeit weiter.

### Restzeit-Visualisierung

2. **AC2:** Given ein Spiel hat eine definierte Gesamtdauer (z.B. 12 Minuten), When die Monitor-Ansicht angezeigt wird, Then ist visuell erkennbar, wie viel Zeit bereits vergangen und wie viel verbleibend ist (Fortschrittsbalken, Countdown oder grafische Anzeige).

### Pause/Ende

3. **AC3:** Given die Spielzeit wird auf der Monitor-Ansicht angezeigt, When die Spieluhr pausiert oder das Spiel beendet wird, Then bleibt die Anzeige konsistent (Stop bei Pause, Endzeit bei Spielende).

### Erkennbarkeit aus Distanz

4. **AC4:** Given ich sehe die Monitor-Ansicht auf Distanz, When ich auf den Bildschirm schaue, Then kann ich ohne genaueres Hinschauen erkennen, ob das Spiel eher am Anfang, in der Mitte oder kurz vor Ende ist.

---

## UX-Hinweise

- Fortschrittsbalken oder Farbwechsel gegen Ende
- Große, gut lesbare Zahlen
- Visuelle Unterscheidung zwischen "viel Zeit" und "wenig Zeit"

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Defects** | DEF-005 |
| **Verwandt** | US-MON-TV-DISPLAY |
