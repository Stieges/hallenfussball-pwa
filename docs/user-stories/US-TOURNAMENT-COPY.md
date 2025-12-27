# US-TOURNAMENT-COPY: Turnier kopieren/duplizieren

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOURNAMENT-COPY |
| **Priorität** | High |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Turnier-Management |
| **Impact** | Hoch |

---

## User Story

**Als** Turnierleiter, der regelmäßig ähnliche Turniere veranstaltet
**möchte ich** ein bestehendes Turnier als Vorlage kopieren können
**damit** ich nicht jedes Mal alle Einstellungen neu eingeben muss

---

## Kontext

Viele Vereine veranstalten jährlich das gleiche Turnier mit denselben Einstellungen (Spielzeit, Anzahl Felder, Modus). Aktuell muss alles neu eingegeben werden.

### Typische Szenarien
1. **Jährliches Hallenturnier:** Gleiche Einstellungen, neue Teams
2. **Turnierserie:** Mehrere Turniere pro Saison mit gleichem Setup
3. **Backup:** Turnier vor großen Änderungen sichern

---

## Acceptance Criteria

### AC1-4: Kopier-Funktion

1. Given ich befinde mich auf der Turnier-Übersicht, When ich das Drei-Punkte-Menü eines Turniers öffne, Then sehe ich die Option "Turnier kopieren".

2. Given ich wähle "Turnier kopieren", Then öffnet sich ein Dialog mit Optionen was kopiert werden soll.

3. Given ich bestätige das Kopieren, Then wird ein neues Turnier erstellt mit dem Namen "[Original-Name] (Kopie)".

4. Given das Turnier wurde kopiert, Then werde ich automatisch zum neuen Turnier weitergeleitet.

### AC5-8: Kopier-Optionen

5. Given der Kopier-Dialog ist offen, Then kann ich auswählen:
   - [x] Turnier-Einstellungen (Spielzeit, Felder, Modus)
   - [x] Gruppen-Struktur (Anzahl und Namen)
   - [ ] Teams (optional - leer starten)
   - [ ] Spielplan (optional - neu generieren)
   - [ ] Ergebnisse (nie kopieren)

6. Given ich kopiere mit Teams, Then werden die Team-Namen übernommen, aber keine Ergebnisse oder Platzierungen.

7. Given ich kopiere ohne Teams, Then sind die Gruppen leer und ich kann neue Teams hinzufügen.

8. Given ich kopiere ein Turnier mit benutzerdefinierten Gruppennamen, Then werden diese ebenfalls kopiert.

### AC9-11: Turnier als Vorlage

9. Given ich habe ein Turnier erfolgreich durchgeführt, When ich es als Vorlage markiere, Then erscheint es in einer separaten "Vorlagen"-Liste.

10. Given ich erstelle ein neues Turnier, Then kann ich "Aus Vorlage erstellen" wählen und eine Vorlage auswählen.

11. Given ich lösche ein Turnier das als Vorlage markiert ist, Then werde ich gewarnt, dass die Vorlage verloren geht.

---

## UI-Konzept

### Kopier-Dialog

```
┌─────────────────────────────────────────────────────────────┐
│                    Turnier kopieren                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Neuer Name: [Hallenturnier 2026                    ]       │
│                                                             │
│  Was soll kopiert werden?                                   │
│                                                             │
│  [x] Grundeinstellungen                                     │
│      Spielzeit, Pausenzeit, Anzahl Felder, Modus            │
│                                                             │
│  [x] Gruppen-Struktur                                       │
│      4 Gruppen mit benutzerdefinierten Namen                │
│                                                             │
│  [ ] Teams übernehmen                                       │
│      16 Teams werden kopiert (ohne Ergebnisse)              │
│                                                             │
│  [ ] Finalrunden-Konfiguration                              │
│      top-4 Preset mit angepassten Labels                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Hinweis: Ergebnisse und Spielstände werden nie kopiert.    │
│                                                             │
│              [Abbrechen]        [Turnier kopieren]          │
└─────────────────────────────────────────────────────────────┘
```

### Turnier-Karte mit Menü

```
┌─────────────────────────────────────────────────────────────┐
│ Hallenturnier 2025                           [⋮]           │
│ 16 Teams · 4 Gruppen · Abgeschlossen          │             │
│ Erstellt: 15.12.2024                          ├─────────┐   │
│                                               │ Öffnen  │   │
│ [Öffnen]                                      │ Kopieren│   │
│                                               │ Löschen │   │
└───────────────────────────────────────────────┴─────────┘
```

---

## Technisches Konzept

### Kopier-Funktion

```typescript
interface CopyOptions {
  includeSettings: boolean;      // Immer true
  includeGroupStructure: boolean;
  includeTeams: boolean;
  includeFinalsConfig: boolean;
  newName: string;
}

function copyTournament(
  source: Tournament,
  options: CopyOptions
): Tournament {
  const copy: Tournament = {
    id: generateUUID(),
    title: options.newName,
    createdAt: new Date().toISOString(),
    status: 'DRAFT',

    // Einstellungen kopieren
    matchDurationMinutes: source.matchDurationMinutes,
    breakBetweenMatchesMinutes: source.breakBetweenMatchesMinutes,
    numberOfFields: source.numberOfFields,
    startTime: source.startTime,

    // Gruppen optional
    groups: options.includeGroupStructure
      ? source.groups.map(g => ({
          ...g,
          id: generateUUID(),
          teams: options.includeTeams
            ? g.teams.map(t => ({ ...t, id: generateUUID() }))
            : []
        }))
      : [],

    // Keine Ergebnisse
    matches: [],

    // Finals optional
    finalsConfig: options.includeFinalsConfig
      ? { ...source.finalsConfig }
      : undefined,
  };

  return copy;
}
```

### localStorage Integration

```typescript
function saveTournamentCopy(copy: Tournament): void {
  const tournaments = loadTournaments();
  tournaments.push(copy);
  saveTournaments(tournaments);
}
```

---

## Phasen

### Phase 1: Basis-Kopie (MVP)
- [ ] "Kopieren" Button im Turnier-Menü
- [ ] Einfacher Dialog mit Name-Eingabe
- [ ] Kopiert Einstellungen + Gruppen (leer)

### Phase 2: Erweiterte Optionen
- [ ] Checkboxen für Teams/Finals
- [ ] Vorschau was kopiert wird

### Phase 3: Vorlagen-System
- [ ] "Als Vorlage speichern"
- [ ] Vorlagen-Liste beim Erstellen

---

## Aufwand

| Phase | Geschätzter Aufwand |
|-------|---------------------|
| Phase 1 | 1-2 Stunden |
| Phase 2 | 1 Stunde |
| Phase 3 | 2 Stunden |

---

## Verwandte User Stories

- **TOUR-CREATE:** Turnier-Erstellung
- **TOUR-EDIT-META:** Turnier-Einstellungen
