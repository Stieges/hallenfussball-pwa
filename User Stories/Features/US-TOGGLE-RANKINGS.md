# US-TOGGLE-RANKINGS: Rangtabellen ein-/ausblenden

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-TOGGLE-RANKINGS |
| **Priorität** | Low |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Viewer |
| **Impact** | Niedrig |

---

## User Story

**Als** Turnierleiter
**möchte ich** die Rangtabellen in der öffentlichen Ansicht ein- oder ausblenden können
**damit** ich kontrollieren kann, wann Zuschauer die Platzierungen sehen

---

## Kontext

Manchmal möchte der Turnierleiter:
- Tabellen erst nach Abschluss der Vorrunde zeigen
- Nur den Spielplan ohne Ranking zeigen
- Spannung aufbauen vor der Siegerehrung

### Ist-Zustand
- Tabellen sind immer sichtbar
- Keine Möglichkeit zur Steuerung

---

## Acceptance Criteria

### AC1-3: Basis-Toggle

1. Given ich bin in den Turnier-Einstellungen, Then sehe ich einen Toggle "Rangtabellen für Zuschauer anzeigen".

2. Given der Toggle ist deaktiviert, Then sehen Zuschauer in der öffentlichen Ansicht nur den Spielplan ohne Tabellen.

3. Given ich aktiviere den Toggle, Then werden die Tabellen sofort in der öffentlichen Ansicht sichtbar.

### AC4-6: Granulare Kontrolle

4. Given ich möchte nur bestimmte Tabellen ausblenden, Then kann ich pro Gruppe entscheiden.

5. Given die Vorrunde läuft noch, Then kann ich "Tabellen automatisch nach Vorrunde anzeigen" aktivieren.

6. Given ich bin der Turnierleiter, Then sehe ich die Tabellen immer (mit Hinweis "Für Zuschauer ausgeblendet").

---

## UI-Konzept

### Einstellungen

```
┌─────────────────────────────────────────────────────────────┐
│ Anzeigeeinstellungen                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Rangtabellen für Zuschauer:                               │
│  ○ Immer anzeigen                                          │
│  ● Manuell steuern                                         │
│  ○ Nach Vorrunde automatisch anzeigen                      │
│                                                             │
│  [Toggle: Tabellen jetzt anzeigen] ○ Aus                   │
│                                                             │
│  Hinweis: Als Turnierleiter sehen Sie Tabellen immer.      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Öffentliche Ansicht (Tabellen ausgeblendet)

```
┌─────────────────────────────────────────────────────────────┐
│ Hallenturnier 2025                                          │
├─────────────────────────────────────────────────────────────┤
│ [Spielplan] [Tabellen]                                      │
│                                                             │
│  (Tabellen-Tab ausgegraut oder nicht vorhanden)            │
│                                                             │
│  ODER:                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Die Tabellen sind derzeit nicht             │   │
│  │        verfügbar. Schauen Sie später vorbei!       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Datenmodell

```typescript
interface TournamentDisplaySettings {
  showRankingsToViewers: 'always' | 'manual' | 'afterGroupStage';
  rankingsVisibleNow: boolean; // Für 'manual' Modus
}
```

### Komponenten-Anpassung

```typescript
// PublicView.tsx
const PublicView: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const showRankings = useMemo(() => {
    const settings = tournament.displaySettings;

    if (settings.showRankingsToViewers === 'always') return true;
    if (settings.showRankingsToViewers === 'manual') {
      return settings.rankingsVisibleNow;
    }
    if (settings.showRankingsToViewers === 'afterGroupStage') {
      return isGroupStageComplete(tournament);
    }
    return true;
  }, [tournament]);

  return (
    <div>
      <Tabs>
        <Tab label="Spielplan">...</Tab>
        {showRankings && <Tab label="Tabellen">...</Tab>}
      </Tabs>
    </div>
  );
};
```

---

## Aufwand

| Komponente | Aufwand |
|------------|---------|
| Datenmodell erweitern | 15 min |
| Einstellungs-UI | 30 min |
| PublicView anpassen | 30 min |
| **Gesamt** | **~1 Stunde** |

---

## Verwandte User Stories

- **PUBLIC-SCHEDULE:** Öffentliche Ansicht
- **RANKING:** Ranglisten-Berechnung
