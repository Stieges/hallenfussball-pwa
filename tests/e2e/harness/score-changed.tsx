/**
 * Prüfstand für den Hinweis „Ergebnis wurde inzwischen von … geändert“ der Schnelleingabe (@FU-104, Fixrunde 2 K1).
 * Die Variante mit „Meine Eingabe behalten“ (Spiel bleibt eintragbar, der gespeicherte Stand ändert sich von außen) ist offline
 * im echten Ablauf nicht erreichbar: ein Ergebnis eines anderen Tabs beendet das Spiel. Diese Seite rendert die echte
 * Finalrunden-Tabelle bzw. -Karte (echte Komponenten, Design-Tokens, i18n, Hell/Dunkel über den echten ThemeProvider);
 * `window.__fremd('geplant' | 'beendet')` setzt Toms 3:1. `?name=` (leer = kein Name) bestimmt den Urheber.
 * Gesendete Stände stehen in `window.__gesendet`. Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { FinalStageSchedule } from '../../../src/components/schedule/FinalStageSchedule';
import type { ScheduledMatch } from '../../../src/core/generators';
import { teamSlot } from '../../../src/core/models/matchSlot';
import { buildTournamentView } from '../../../src/core/view';
import type { Match, Team } from '../../../src/types/tournament';
import { createMockTournament } from '../../../src/test/factories';
import { cssVars } from '../../../src/design-tokens';

type Fremd = 'geplant' | 'beendet';

declare global {
  interface Window {
    __fremd: (art: Fremd) => void;
    __gesendet: Array<[string, number, number]>;
  }
}

const NORD = '00000000-0000-4000-8000-0000000000d1';
const SUED = '00000000-0000-4000-8000-0000000000d2';
const HF1 = '00000000-0000-4000-8000-0000000104a1';
const teams: Team[] = [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }];
const name = new URLSearchParams(window.location.search).get('name') ?? 'Tom';

function stand(art: Fremd | null): { matches: ScheduledMatch[]; tournament: { teams: Team[]; view: ReturnType<typeof buildTournamentView> } } {
  const start = new Date('2026-11-14T14:20:00');
  const scores = art === null ? { scoreB: 2 } : { scoreA: 3, scoreB: 1 };
  const scheduled: ScheduledMatch = {
    id: HF1, matchNumber: 9, time: '14:20', field: 1, homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED,
    slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: 'Halbfinale 1', phase: 'semifinal', isFinal: true,
    startTime: start, endTime: start, duration: 10, ...scores,
  };
  const match: Match = {
    id: HF1, round: 1, field: 1, slotA: teamSlot(NORD), slotB: teamSlot(SUED), isFinal: true, label: 'Halbfinale 1', matchNumber: 9,
    phase: 'semifinal', ...scores, ...(art === 'beendet' ? { matchStatus: 'finished' as const } : {}),
  };
  const tournament = createMockTournament({ teams, matches: [match] });
  return { matches: [scheduled], tournament: { teams, view: buildTournamentView(tournament, { audience: 'organizer', medium: 'app', locale: 'de' }) } };
}

window.__gesendet = [];

// Ohne eigene Komponente: `root.render` mit gleichem Baum behält den Zustand der Zelle (Entwurf), wie ein Neuzeichnen in der App.
const root = ReactDOM.createRoot(document.getElementById('root')!);
function zeichne(art: Fremd | null): void {
  const { matches, tournament } = stand(art);
  root.render(
    <ThemeProvider>
      <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.background, minHeight: '100vh' }}>
        <FinalStageSchedule
          matches={matches}
          tournament={tournament}
          editable
          onScoreChange={(id, a, b) => { window.__gesendet.push([id, a, b]); }}
          onStartCorrection={() => undefined}
          changeAuthorOf={async () => (name === '' ? null : name)}
        />
      </div>
    </ThemeProvider>,
  );
}
window.__fremd = zeichne;
zeichne(null);
