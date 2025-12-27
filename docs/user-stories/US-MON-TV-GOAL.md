# US-MON-TV-GOAL: Tor-Animation auf Monitor

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MON-TV-GOAL |
| **Priorität** | Medium |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Monitor |
| **Impact** | Mittel |

---

## User Story

**Als** Zuschauer in der Halle
**möchte ich** bei einem Tor in der Monitor-Ansicht eine kurze Tor-Animation sehen
**damit** Tore emotional hervorgehoben werden und klar erkennbar ist, welches Team getroffen hat

---

## Acceptance Criteria

### Animation bei Tor

1. **AC1:** Given die Monitor-Ansicht ist geöffnet und ein Tor wird erfasst, When das Tor-Event registriert wird, Then erscheint auf der Seite des treffenden Teams eine kurze Tor-Animation (Aufleuchten, Animation, 'TOR!'-Banner).

### Rückkehr zur Normalanzeige

2. **AC2:** Given ein Tor wurde angezeigt, When die Tor-Animation abgelaufen ist, Then kehrt die Darstellung in den normalen Monitor-Zustand zurück.

### Mehrere Tore

3. **AC3:** Given mehrere Tore kurz hintereinander fallen, When mehrere Tor-Events ausgelöst werden, Then wird für jedes Tor eine Animation abgespielt, ohne dass Spielstand oder Zeit verloren gehen.

### Fallback

4. **AC4:** Given Tor-Animationen sind optional/deaktiviert, When eine Animation nicht unterstützt ist, Then wird dennoch der Spielstand korrekt aktualisiert.

---

## UX-Hinweise

- Animation maximal 3-5 Sekunden
- Klar erkennbar auf welcher Seite (Heim/Gast)
- Nicht zu aufdringlich, aber festlich

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Defects** | DEF-004 |
| **Verwandt** | US-MON-TV-DISPLAY, US-MON-TV-GOAL-SFX |
