# Match Cockpit Komponente

**Reine Präsentationskomponente** für die Live-Spielverwaltung im Admin-/Kampfgericht-Cockpit.

## ✅ Architektur-Prinzipien

Diese Komponente folgt strikt der **Single Source of Truth** Architektur:

- ✅ **Alle Daten über Props** - Keine API-Calls, kein `fetch`, kein `axios`
- ✅ **Nur Callbacks nach oben** - Komponente feuert nur Events, keine Geschäftslogik
- ✅ **Wiederverwendung** - Nutzt zentrale UI-Komponenten (`Button`, `Card`) und Theme-System
- ✅ **Keine Redundanz** - Keine hart codierten Daten oder duplizierte Logik
- ✅ **TypeScript-First** - Saubere, typsichere Interfaces

## 📂 Struktur

```
src/components/match-cockpit/
├── MatchCockpit.tsx           # Hauptkomponente (Layout + Header)
├── CurrentMatchPanel.tsx      # Aktuelles Spiel (Scoreboard, Timer, Events)
├── UpcomingMatchesSidebar.tsx # Anstehende Spiele
├── index.ts                   # Export Barrel
└── README.md                  # Diese Datei
```

## 🚀 Verwendung

### Beispiel: Demo Screen

Siehe [MatchCockpitDemoScreen.tsx](../../screens/MatchCockpitDemoScreen.tsx) für ein vollständiges Beispiel.

```tsx
import { MatchCockpit, LiveMatch, MatchSummary } from '../components/match-cockpit';

export const MyMatchScreen: React.FC = () => {
  const [currentMatch, setCurrentMatch] = useState<LiveMatch>(...);

  return (
    <MatchCockpit
      fieldName="Feld 1"
      tournamentName="Mein Turnier 2025"
      currentMatch={currentMatch}
      upcomingMatches={upcomingMatches}

      // Callbacks
      onStart={(matchId) => { /* API Call */ }}
      onPause={(matchId) => { /* API Call */ }}
      onFinish={(matchId) => { /* API Call */ }}
      onGoal={(matchId, teamId, delta) => { /* API Call */ }}
      onUndoLastEvent={(matchId) => { /* API Call */ }}
      onManualEditResult={(matchId, home, away) => { /* API Call */ }}
      onLoadNextMatch={(fieldId) => { /* API Call */ }}
      onReopenLastMatch={(fieldId) => { /* API Call */ }}
    />
  );
};
```

## 📋 Props Interface

```typescript
interface MatchCockpitProps {
  // Meta-Informationen
  fieldName: string;
  tournamentName: string;

  // Spiel-Daten
  currentMatch: LiveMatch | null;
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;
  upcomingMatches: MatchSummary[];
  highlightNextMatchMinutesBefore?: number;

  // Event Callbacks
  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onFinish(matchId: string): void;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onUndoLastEvent(matchId: string): void;
  onManualEditResult(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch(fieldId: string): void;
}
```

## 🎨 Features

### Aktuelles Spiel
- ⚡ **Live-Timer** - Läuft von außen gesteuert via `elapsedSeconds` Prop
- ⚽ **Tor-Buttons** - Schnelles Eintragen von Toren (+1/-1)
- 🎮 **Spiel-Controls** - Start, Pause, Beenden
- 📜 **Event-Liste** - Alle Ereignisse mit Undo-Funktion
- ✏️ **Manuelles Ergebnis** - Korrektur-Möglichkeit

### Anstehende Spiele
- 📅 **Nächste Spiele** - Sidebar mit kommenden Matches
- ⚠️ **Warnung** - Highlight wenn nächstes Spiel < 5 Min entfernt
- 🎤 **Stadionsprecher-Tools** - Ansage-Text, Hallenanzeige (Platzhalter)

### Letztes Spiel
- 🔄 **Wiedereröffnen** - Letztes beendetes Spiel kann wieder geöffnet werden
- 📊 **Ergebnis-Anzeige** - Kompaktes Banner mit Score

## 🏗️ Integration in Production

### Container-Komponente (State Management)

Der Container (z.B. `MatchCockpitScreen.tsx`) ist verantwortlich für:

1. **Daten laden** - von API/Backend
2. **WebSocket** - für Live-Updates
3. **State Management** - Redux/Zustand/Context
4. **API-Calls** - in den Callback-Handlern

```tsx
// Beispiel: Production Container
export const MatchCockpitScreen: React.FC = () => {
  const { currentMatch, isLoading } = useCurrentMatch('field-1');
  const { upcomingMatches } = useUpcomingMatches('field-1');
  const { updateMatch } = useMatchMutations();

  const handleGoal = async (matchId: string, teamId: string, delta: 1 | -1) => {
    await updateMatch.mutate({ matchId, action: 'goal', teamId, delta });
  };

  // ... weitere Handler

  if (isLoading) return <LoadingSpinner />;

  return (
    <MatchCockpit
      currentMatch={currentMatch}
      upcomingMatches={upcomingMatches}
      onGoal={handleGoal}
      // ...
    />
  );
};
```

### Backend-Integration

Die Komponente erwartet diese Datenstruktur (kann aus bestehenden Types gemappt werden):

```typescript
// Mapping von existierenden Types
import { ScheduledMatch, Team as TournamentTeam } from '../../types/tournament';

function mapToLiveMatch(scheduledMatch: ScheduledMatch, liveData: LiveData): LiveMatch {
  return {
    id: scheduledMatch.id,
    number: scheduledMatch.matchNumber,
    phaseLabel: scheduledMatch.phase || 'Vorrunde',
    fieldId: `field-${scheduledMatch.field}`,
    scheduledKickoff: scheduledMatch.time,
    durationSeconds: scheduledMatch.duration * 60,
    refereeName: getRefereeNameFromNumber(scheduledMatch.referee),
    homeTeam: { id: scheduledMatch.homeTeamId, name: scheduledMatch.homeTeam },
    awayTeam: { id: scheduledMatch.awayTeamId, name: scheduledMatch.awayTeam },
    homeScore: liveData.homeScore,
    awayScore: liveData.awayScore,
    status: liveData.status,
    elapsedSeconds: liveData.elapsedSeconds,
    events: liveData.events,
  };
}
```

## 🔧 Anpassungen

### Theme anpassen

Die Komponente nutzt das zentrale Theme-System aus `src/styles/theme.ts`.
Farben, Abstände, Schriftgrößen können dort global geändert werden.

### Zusätzliche Features

Erweiterungen sollten über Props erfolgen:

```typescript
// Beispiel: Zusätzliche Statistiken
interface MatchCockpitProps {
  // ... bestehende Props
  showStatistics?: boolean;
  statisticsData?: MatchStatistics;
}
```

## 📚 Verwandte Komponenten

- [Button.tsx](../ui/Button.tsx) - Wiederverwendbare Button-Komponente
- [Card.tsx](../ui/Card.tsx) - Wiederverwendbare Card-Komponente
- [theme.ts](../../styles/theme.ts) - Zentrales Design-System

## 🐛 Troubleshooting

### Timer läuft nicht

Der Timer wird **nicht intern** von der Komponente verwaltet. Der Container muss `elapsedSeconds` kontinuierlich aktualisieren (z.B. via `setInterval` oder WebSocket).

### Callbacks werden nicht gefeuert

Prüfe, ob alle Callback-Props korrekt übergeben wurden. Die Komponente nutzt diese für alle Aktionen.

### Styling passt nicht

Die Komponente nutzt das zentrale Theme. Prüfe `src/styles/theme.ts` oder überschreibe Styles via `style` Props an den Card-Komponenten.

## 📄 Lizenz

Teil des hallenfussball-pwa Projekts.
