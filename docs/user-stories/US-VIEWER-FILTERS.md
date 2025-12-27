# US-VIEWER-FILTERS: Erweiterte Filteroptionen für Zuschauer

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-VIEWER-FILTERS |
| **Priorität** | High |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Viewer |
| **Impact** | Sehr Hoch |

---

## User Story

**Als** Zuschauer in der Halle oder zuhause
**möchte ich** verschiedene Filter auf den öffentlichen Spielplan anwenden können
**damit** ich schnell die für mich relevanten Spiele, Teams oder Gruppen finde

---

## Filter-Features

### Übersicht der Filter

| # | Filter | Priorität | Status |
|---|--------|-----------|--------|
| 38 | Nach Vorrunde/Finalrunde | High | Vorhanden (Tabs) |
| 39 | Nach Gruppe | High | Vorhanden (GroupTables) |
| 40 | Nach einzelnem Team | High | Teilweise (PUBLIC-SCHEDULE-HIGHLIGHT-CLUB-01) |
| 41 | Nach Spielfeld | Medium | Vorhanden (ManagementTab) |
| 42 | Nach Schiedsrichter | Low | Nicht vorhanden |
| 43 | Nach Spieltag | N/A | Nicht relevant (kein Liga-Modus) |
| 44 | Nur aktive/laufende Spiele | Medium | Nicht vorhanden |
| 45 | Filter in URL speicherbar | High | Nicht vorhanden |

---

## Acceptance Criteria

### AC1-5: Team-Filter (erweitert PUBLIC-SCHEDULE-HIGHLIGHT-CLUB-01)

1. Given ich befinde mich im öffentlichen Spielplan, When ich auf einen Teamnamen tippe, Then wird dieses Team als "ausgewählt" markiert und alle seine Spiele werden hervorgehoben.

2. Given ein Team ausgewählt ist, When ich die URL kopiere und teile, Then enthält die URL den Team-Filter als Query-Parameter (z.B. `?team=fc-bayern`).

3. Given ein Elternteil öffnet die URL mit Team-Filter, Then ist das Team direkt ausgewählt und hervorgehoben ohne weitere Aktion.

4. Given ein Team ausgewählt ist, When ich auf "Nur Spiele anzeigen" tippe, Then werden NUR die Spiele dieses Teams angezeigt (nicht nur hervorgehoben).

5. Given mehrere Teams aus verschiedenen Gruppen spielen, When ich ein Team auswähle, Then wird automatisch zur entsprechenden Gruppe gescrollt.

### AC6-9: Nur aktive Spiele (#44)

6. Given ich befinde mich im öffentlichen Spielplan, When ich den Filter "Nur laufende Spiele" aktiviere, Then werden nur Spiele mit Status 'RUNNING' angezeigt.

7. Given kein Spiel aktuell läuft und Filter aktiv, Then erscheint ein Hinweis "Aktuell kein Spiel aktiv" mit Option zur Anzeige des nächsten Spiels.

8. Given ich habe den Filter "Nur laufende Spiele" aktiviert, When ein Spiel endet, Then verschwindet es automatisch aus der gefilterten Ansicht.

9. Given ein neues Spiel beginnt während ich die gefilterte Ansicht betrachte, Then erscheint es automatisch in der Ansicht (Live-Update).

### AC10-14: Filter in URL speichern (#45)

10. Given ich wähle Filter (Team, Gruppe, Feld), When die Auswahl getroffen ist, Then aktualisiert sich die URL automatisch ohne Seitenneuladen.

11. Given die URL enthält Filter-Parameter, When ich diese URL öffne, Then werden alle Filter automatisch angewendet.

12. Given ich wähle mehrere Filter kombiniert (z.B. Gruppe A + nur laufend), Then sind beide in der URL gespeichert.

13. Given ich teile die gefilterte URL via QR-Code/WhatsApp, Then sieht der Empfänger exakt dieselbe gefilterte Ansicht.

14. Given ich setze alle Filter zurück, Then wird die URL auf die Basis-URL zurückgesetzt (ohne Query-Parameter).

### AC15-17: Erweiterte Team-Filterung

15. Given ich habe ein Team ausgewählt, When ich auf die Tabellen-Ansicht wechsle, Then ist dieses Team in allen Tabellen hervorgehoben (fett, farbig markiert).

16. Given ich bin Elternteil eines bestimmten Teams, When ich den QR-Code am Halleneingang scanne, Then kann ich mein Team aus einer Liste auswählen und dieser Filter bleibt für die Session gespeichert.

17. Given der Turnier-Organisator hat Team-Logos hochgeladen, Then werden diese in der Team-Auswahl angezeigt für einfachere Identifikation.

---

## URL-Schema

```
# Basis
/tournament/{id}/public

# Mit Filtern
/tournament/{id}/public?team=fc-bayern
/tournament/{id}/public?group=A
/tournament/{id}/public?field=1
/tournament/{id}/public?live=true
/tournament/{id}/public?phase=finals

# Kombiniert
/tournament/{id}/public?team=fc-bayern&live=true
/tournament/{id}/public?group=A&field=2
```

---

## UI-Konzept

### Filter-Leiste (Mobile)

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Filter: [Team ▼] [Gruppe ▼] [Feld ▼] [🔴 Live]          │
├─────────────────────────────────────────────────────────────┤
│ Aktive Filter: 🏷️ FC Bayern  🏷️ Nur Live   [✕ Alle löschen]│
└─────────────────────────────────────────────────────────────┘
```

### Team-Auswahl Dialog

```
┌─────────────────────────────────────────────────────────────┐
│                    Team auswählen                           │
├─────────────────────────────────────────────────────────────┤
│ 🔍 [Team suchen...                              ]           │
│                                                             │
│ Gruppe A:                                                   │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 🔵 FC Bayern München                                  │   │
│ │ 🔴 TSV 1860 München                                   │   │
│ │ ⚪ SpVgg Unterhaching                                 │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ Gruppe B:                                                   │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 🟢 VfB Stuttgart                                      │   │
│ │ ...                                                   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│                [Abbrechen]    [✓ Auswählen]                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Filter-State

```typescript
interface ViewerFilters {
  teamId?: string;           // Einzelnes Team hervorheben/filtern
  teamMode: 'highlight' | 'only'; // Hervorheben oder nur zeigen
  group?: string;            // 'A', 'B', 'C'...
  field?: number;            // 1, 2, 3...
  liveOnly: boolean;         // Nur laufende Spiele
  phase?: 'groupStage' | 'finals';
}

// URL Serialization
function filtersToUrl(filters: ViewerFilters): string {
  const params = new URLSearchParams();
  if (filters.teamId) params.set('team', filters.teamId);
  if (filters.teamMode === 'only') params.set('teamMode', 'only');
  if (filters.group) params.set('group', filters.group);
  if (filters.field) params.set('field', String(filters.field));
  if (filters.liveOnly) params.set('live', 'true');
  if (filters.phase) params.set('phase', filters.phase);
  return params.toString();
}
```

### Komponenten

```
src/
├── features/
│   └── public-view/
│       ├── ViewerFilters.tsx      # Filter-Leiste
│       ├── TeamSelector.tsx       # Team-Auswahl Dialog
│       ├── FilterChips.tsx        # Aktive Filter anzeigen
│       └── useViewerFilters.ts    # Hook für Filter-State + URL-Sync
```

---

## Phasen

### Phase 1: Basis-Filter (MVP)
- [ ] Team-Highlight (erweitern von PUBLIC-SCHEDULE-HIGHLIGHT-CLUB-01)
- [ ] Filter in URL speichern
- [ ] "Nur Live" Filter

### Phase 2: Erweiterte Filter
- [ ] Team-Auswahl Dialog mit Suche
- [ ] Gruppen-Filter
- [ ] Feld-Filter
- [ ] Kombinierte Filter

### Phase 3: UX-Verbesserungen
- [ ] Filter-Chips mit One-Click-Remove
- [ ] "Mein Team merken" (localStorage)
- [ ] QR-Code mit vorausgewähltem Team

---

## Verwandte User Stories

- **PUBLIC-SCHEDULE-HIGHLIGHT-CLUB-01:** Basis-Team-Highlight (wird erweitert)
- **MON-TV-01 bis MON-TV-04:** Monitor-Ansicht
- **US-INVITE:** Öffentliches Teilen
