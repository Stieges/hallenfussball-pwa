# US-MON-TV-DISPLAY: Monitor-Ansicht für TV-Display

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MON-TV-DISPLAY |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Monitor |
| **Impact** | Sehr Hoch |

---

## User Story

**Als** Zuschauer in der Halle
**möchte ich** auf einem TV-Bildschirm eine speziell optimierte Monitor-Ansicht sehen
**damit** ich den Spielverlauf bequem und gut lesbar aus der Distanz verfolgen kann

---

## Kontext

Die Monitor-Ansicht ist für TV-Displays in Sporthallen optimiert. Sie zeigt nur die wichtigsten Informationen in großer, gut lesbarer Schrift und aktualisiert sich automatisch.

---

## Acceptance Criteria

### Basis-Darstellung

1. **AC1:** Given ich befinde mich im Reiter 'Monitor' eines laufenden Spiels, When die Ansicht auf einem TV geöffnet wird, Then wird die aktuelle Paarung (Heimteam vs. Gastteam) prominent und klar lesbar angezeigt.

2. **AC2:** Given ich befinde mich im Reiter 'Monitor', When das Spiel läuft, Then wird der aktuelle Spielstand (Tore Heim/Gast) groß und gut sichtbar dargestellt.

3. **AC3:** Given die Monitor-Ansicht wird auf einem TV genutzt, When die Seite geladen wird, Then enthält sie keine überflüssigen Bedienelemente (Buttons, Formulare).

### Auto-Update

4. **AC4:** Given die Monitor-Ansicht ist geöffnet, When der Spielstand sich ändert (z.B. Tor), Then wird der neue Spielstand ohne manuellen Reload automatisch aktualisiert.

---

## UX-Hinweise

- Maximaler Kontrast für Lesbarkeit aus der Distanz
- Keine ablenkenden UI-Elemente
- Vollbild-optimiert

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | US-MON-TV-TIMER, US-MON-TV-GOAL, US-MON-TV-PREVIEW |
