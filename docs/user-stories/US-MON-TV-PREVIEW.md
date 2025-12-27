# US-MON-TV-PREVIEW: Nächste Paarung Preview

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MON-TV-PREVIEW |
| **Priorität** | Medium |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Monitor |
| **Impact** | Hoch |

---

## User Story

**Als** Zuschauer in der Halle
**möchte ich** kurz vor Ende eines Spiels eine Vorschau der nächsten Paarung sehen
**damit** ich weiß, welche Teams als nächstes spielen und mich rechtzeitig darauf einstellen kann

---

## Acceptance Criteria

### Automatische Einblendung

1. **AC1:** Given ein Spiel läuft in der Monitor-Ansicht, When die verbleibende Spielzeit auf 3 Minuten oder weniger sinkt, Then wird automatisch die nächste geplante Paarung für dieses Spielfeld eingeblendet.

### Dauer der Preview

2. **AC2:** Given die verbleibende Spielzeit beträgt 3 Minuten oder weniger, When die Vorschau eingeblendet wird, Then bleibt diese für ca. 7 Sekunden sichtbar, bevor die Anzeige zum aktuellen Spiel zurückkehrt.

### Rückkehr zum aktuellen Spiel

3. **AC3:** Given die Vorschau wurde angezeigt und ist ausgeblendet, When die Spielzeit weiterläuft, Then wird wieder das aktuelle Spiel angezeigt (ohne manuelle Aktionen).

### Kein nächstes Spiel

4. **AC4:** Given es existiert keine nachfolgende Paarung (letztes Spiel), When die Restspielzeit 3 Minuten erreicht, Then wird keine Preview eingeblendet und die Monitor-Ansicht bleibt beim aktuellen Spiel.

### Vorzeitiges Ende

5. **AC5:** Given die Vorschau-Logik wurde getriggert, When das Spiel vorzeitig beendet wird, Then wird die Vorschau nicht mehr automatisch eingeblendet oder sofort beendet.

---

## UX-Hinweise

- Preview dezent, aber lesbar
- Klare Unterscheidung zwischen aktuellem Spiel und Preview
- "Als nächstes:" Label für die Preview

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | US-MON-TV-DISPLAY |
