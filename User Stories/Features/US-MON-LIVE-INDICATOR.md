# US-MON-LIVE-INDICATOR: Live-Markierung für Spiele

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MON-LIVE-INDICATOR |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Monitor |
| **Impact** | Mittel |

---

## User Story

**Als** Zuschauer und Mitglied der Turnierleitung
**möchte ich** dass gestartete Spiele im Spielplan und im Cockpit als 'live' gekennzeichnet werden
**damit** ich auf einen Blick erkennen kann, welches Spiel aktuell läuft

---

## Acceptance Criteria

### Öffentlicher Spielplan

1. **AC1:** Given ein Spiel wurde im Reiter 'Turnierleitung' gestartet (Status 'laufend'), When ich den öffentlichen Spielplan betrachte, Then wird dieses Spiel mit einem 'LIVE'-Symbol gekennzeichnet und optisch hervorgehoben.

### Turnierleitungs-Cockpit

2. **AC2:** Given ein Spiel wurde gestartet, When ich im Cockpit der Turnierleitung den Spielplan betrachte, Then wird dieses Spiel ebenfalls mit einem 'LIVE'-Symbol gekennzeichnet.

### Nur aktive Spiele

3. **AC3:** Given mehrere Spiele existieren, When genau eines gestartet ist, Then zeigt nur dieses eine Spiel das 'LIVE'-Symbol.

### Spielende

4. **AC4:** Given ein laufendes Spiel wird beendet (Status 'beendet'), When ich den Spielplan betrachte, Then verschwindet die 'LIVE'-Kennzeichnung.

### Zurücksetzen auf geplant

5. **AC5:** Given ein Spiel war fälschlicherweise gestartet worden und wird zurückgesetzt, When ich den Spielplan betrachte, Then wird die 'LIVE'-Kennzeichnung entfernt.

### Nicht gestartete Spiele

6. **AC6:** Given ein Spiel ist nicht gestartet (Status 'geplant'), When ich den Spielplan betrachte, Then wird kein 'LIVE'-Symbol angezeigt.

### Live-Update

7. **AC7:** Given der Status eines Spiels ändert sich, When die Ansicht geöffnet ist, Then wird die 'LIVE'-Kennzeichnung ohne manuelles Neuladen aktualisiert.

---

## UX-Hinweise

- Einheitliches 'LIVE'-Badge mit Signalfarbe (rotes Badge mit 'LIVE')
- Komplette Zeile des laufenden Spiels leicht hinterlegen
- In der Turnierleitung das laufende Spiel in einer 'Aktuelles Spiel'-Sektion oben anzeigen
- Optional: Legende einblenden die erklärt 'LIVE = Spiel läuft gerade'
- Mobile: 'LIVE'-Badge groß genug, kontrastreiche Farben

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | US-TL-RESULT-LOCK |
