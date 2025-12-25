# US-AUTO-TIME-CONTINUATION: Zeiten automatisch fortführen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-AUTO-TIME-CONTINUATION |
| **Priorität** | Low |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Live-Steuerung |
| **Impact** | Niedrig |

---

## User Story

**Als** Turnierleiter
**möchte ich** dass Spielzeiten nach einem absolvierten Spiel automatisch weiterlaufen
**damit** ich nicht bei jeder Spielpause die nächste Startzeit manuell berechnen muss

---

## Kontext

Aktuell werden Spielzeiten im Schedule-Generator als feste Zeiten berechnet (z.B. "09:00", "09:12", "09:24"). Diese berücksichtigen nicht, wenn ein Spiel länger oder kürzer dauert als geplant.

### Ist-Zustand
- Spielzeiten werden bei Turniererstellung berechnet
- Zeiten sind statisch und ändern sich nicht
- Bei Verzögerungen müssen Spieler selbst schätzen wann sie dran sind

### Soll-Zustand
- Nach Spielende wird automatisch die nächste Startzeit angepasst
- Verzögerungen propagieren sich durch den Zeitplan
- Zuschauer sehen immer realistische Anstoßzeiten

---

## Acceptance Criteria

### AC1-3: Automatische Zeitfortführung

1. Given ein Spiel endet im MatchCockpit, When das Spiel 2 Minuten länger als geplant gedauert hat, Then werden alle folgenden Spiele auf diesem Feld um 2 Minuten nach hinten verschoben.

2. Given ein Spiel endet früher als geplant, When ich die Option "Puffer beibehalten" aktiviert habe, Then bleiben die Folgezeiten unverändert (keine Vorverlegung).

3. Given mehrere Felder spielen parallel, When Feld 1 eine Verzögerung hat, Then sind nur die Spiele auf Feld 1 betroffen, nicht die anderen Felder.

### AC4-6: Manuelle Kontrolle

4. Given Zeiten wurden automatisch angepasst, When ich das nächste Spiel starte, Then sehe ich einen Hinweis "Startzeit angepasst: Ursprünglich 09:24, jetzt 09:26".

5. Given ich möchte die automatische Anpassung rückgängig machen, When ich "Originalzeiten wiederherstellen" wähle, Then werden alle Zeiten auf die ursprünglichen Planzeiten zurückgesetzt.

6. Given ich bin in der Management-Ansicht, When ich einen Zeitplan-Puffer einfügen möchte, Then kann ich manuell "+5 Min Pause" zwischen Spielen einfügen.

### AC7-9: Visualisierung

7. Given ein Spiel wurde zeitlich verschoben, Then wird die neue Zeit in Orange/Gelb dargestellt, um die Änderung hervorzuheben.

8. Given die öffentliche Ansicht zeigt Spielzeiten, When eine Verzögerung eintritt, Then aktualisiert sich die Anzeige automatisch (Live-Update).

9. Given ein Elternteil hat die App offen, Then zeigt ein Banner "Zeitplan aktualisiert: Ihr nächstes Spiel wurde auf XX:XX verschoben".

---

## Technisches Konzept

### Datenmodell-Erweiterung

```typescript
interface ScheduledMatch {
  // Bestehend
  time: string;              // Ursprüngliche geplante Zeit

  // Neu
  originalTime: string;      // Kopie der ursprünglichen Zeit
  adjustedTime?: string;     // Angepasste Zeit nach Verzögerung
  timeAdjustmentReason?: 'delay' | 'early' | 'manual';
}

interface TournamentSettings {
  autoAdjustTimes: boolean;         // Feature aktiviert
  propagateDelays: boolean;         // Verzögerungen weitergeben
  keepBufferOnEarlyFinish: boolean; // Bei frühem Ende Puffer behalten
}
```

### Berechnung

```typescript
function recalculateUpcomingTimes(
  schedule: GeneratedSchedule,
  finishedMatchId: string,
  actualEndTime: Date
): GeneratedSchedule {
  const finishedMatch = findMatch(schedule, finishedMatchId);
  const plannedEndTime = calculatePlannedEndTime(finishedMatch);
  const delayMinutes = Math.floor((actualEndTime - plannedEndTime) / 60000);

  if (delayMinutes <= 0 && settings.keepBufferOnEarlyFinish) {
    return schedule; // Keine Änderung
  }

  // Alle folgenden Spiele auf diesem Feld anpassen
  return shiftMatchesOnField(schedule, finishedMatch.field, delayMinutes);
}
```

---

## Phasen

### Phase 1: Basis (MVP)
- [ ] Datenmodell mit `adjustedTime`
- [ ] Manuelle Zeit-Anpassung pro Spiel
- [ ] Anzeige der angepassten Zeit in UI

### Phase 2: Automatisierung
- [ ] Auto-Berechnung bei Spielende
- [ ] Propagation auf Folgespiele
- [ ] Setting für Feature ein/aus

### Phase 3: Benachrichtigungen
- [ ] Live-Update in öffentlicher Ansicht
- [ ] Banner für Zeitänderungen
- [ ] Optional: Push-Notifications

---

## Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Komplexe Abhängigkeiten bei Finalrunde | Mittel | Hoch | Phase 1 nur Vorrunde |
| User-Verwirrung durch häufige Änderungen | Mittel | Mittel | Änderungs-Historie zeigen |
| Performance bei vielen Updates | Niedrig | Mittel | Debounce Updates |

---

## Verwandte User Stories

- **MatchCockpit Timer:** Basis für Spielzeit-Tracking
- **PUBLIC-SCHEDULE:** Zeigt Zeiten in öffentlicher Ansicht
