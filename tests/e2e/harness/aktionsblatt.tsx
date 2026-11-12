/**
 * Prüfstand für das Aktionsblatt am Spiel im Spielplan (@SL-239, G3-N N3). Die ECHTE Spielplan-Ansicht (ScheduleDisplay) mit echtem
 * Spielplan-Generator, Design-Tokens, i18n und Hell/Dunkel über den echten ThemeProvider; die Wege hinter den Tasten sind Attrappen.
 * Query: `zustand=geplant|laeuft|beendet` (Spiel 1), `rechte=leitung|helfer` (Helfer: im echten Ablauf nur mit Server erreichbar),
 * `lang=1` (50-Zeichen-Teamnamen), `sprache=en`. Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { RepositoryProvider } from '../../../src/core/contexts/RepositoryContext';
import { ToastProvider } from '../../../src/components/ui/Toast';
import { ScheduleDisplay } from '../../../src/components/ScheduleDisplay';
import { MatchTimeShiftContext } from '../../../src/components/schedule/matchTimeShiftContext';
import { generateFullSchedule } from '../../../src/core/generators';
import { buildTournamentView } from '../../../src/core/view';
import type { Match, Team } from '../../../src/types/tournament';
import { createMockTournament } from '../../../src/test/factories';
import { cssVars } from '../../../src/design-tokens';

const query = new URLSearchParams(window.location.search);
if (query.get('sprache') === 'en') { void i18n.changeLanguage('en'); }
const zustand = query.get('zustand') ?? 'geplant';
const helfer = query.get('rechte') === 'helfer';
const lang = query.get('lang') === '1';
const noop = (): void => undefined;

const NAMEN = lang
  ? ['Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V.', 'Turn- und Sportverein Petting-Oberhausen 1888', 'DJK Kammer', 'TSV Waging rot']
  : ['DJK Kammer', 'TSV Petting', 'TSV Waging rot', 'DJK Otting'];
const teams: Team[] = NAMEN.map((name, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, name }));
const turnier = createMockTournament({ id: 'harness-aktion', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin', refereeConfig: { mode: 'organizer', numberOfReferees: 2 } });
const plan = generateFullSchedule(turnier);
const STAND: Record<string, Partial<Match>> = {
  geplant: {},
  laeuft: { matchStatus: 'running', scoreA: 1, scoreB: 0 },
  beendet: { matchStatus: 'finished', scoreA: 2, scoreB: 1 },
};
const current: Match[] = plan.allMatches.map((m, i) => ({
  id: m.id, round: 1, field: m.field, slotA: m.slotA, slotB: m.slotB, group: m.group, isFinal: m.isFinal, label: m.label, matchNumber: m.matchNumber,
  phase: m.phase, referee: m.referee, ...(i === 0 ? STAND[zustand] : {}),
}));
const view = buildTournamentView(createMockTournament({ ...turnier, matches: current }), { audience: 'organizer', medium: 'app', locale: 'de' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
   <RepositoryProvider user={null}>
    <ToastProvider>
      <MatchTimeShiftContext.Provider value={{ originalTimeOf: () => undefined, shiftFrom: noop }}>
        <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.background, minHeight: '100vh' }}>
          <ScheduleDisplay
            schedule={plan} currentMatches={current} view={view} editable actionRights={helfer ? { lead: false, play: true, schedule: false } : { lead: true, play: true, schedule: true }}
            onNavigateToCockpit={noop} onCorrect={noop} onScoreChange={() => true} onRefereeChange={noop} onFieldChange={noop} forfeit={{ mark: noop, revoke: noop }}
            canEndRunning={!helfer}
          />
        </div>
      </MatchTimeShiftContext.Provider>
    </ToastProvider>
   </RepositoryProvider>
  </ThemeProvider>,
);
