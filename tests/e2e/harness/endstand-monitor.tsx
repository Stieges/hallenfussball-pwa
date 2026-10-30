/**
 * Prüfstand R3-7 (Regel T2-UI): Folien „Endstand“ und „Torschützen“ am Monitor – ECHTE Folien-Komponenten (`SlideRenderer`), Design-Tokens,
 * feste Anzeigesprache, Rahmen wie die Monitor-Seite (Vollfläche, Bildrand wie `?rand=`). Ersetzt ist nur die Server-Antwort (feste
 * Werte), weil Server und ein abgeschlossenes Turnier offline fehlen. Nur Testumgebung, nicht Teil des Builds.
 * Adresse: `?szene=<id>&seite=<n>&thema=dark|light&rand=<Prozent>`; ids: end6 (6 Teams), end8 (8 Teams, Seite 1/2 und 2/2), lang (8 Teams,
 * 50-Zeichen-Namen, 4 Seiten), tor (Torschützen), tor2 (Torschützen, 2. Seite), kids (Kindermodus), geteilt (Plätze 1, 2, 2, 4).
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import { I18nextProvider } from 'react-i18next';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { anzeigeI18n } from '../../../src/i18n/anzeigeSprache';
import { TeamIdSchema } from '../../../src/core/models/schemas/MatchSlotSchema';
import type { FinalStandingRow, ScorerRow } from '../../../src/core/standings/finalStandings';
import type { MonitorEnd } from '../../../src/features/monitor-display/monitorEnd';
import { END_SCORERS_SLIDE, END_STANDINGS_SLIDE } from '../../../src/features/monitor-display/monitorEnd';
import { SlideRenderer } from '../../../src/features/monitor-display/slides/SlideRenderer';
import { containerStyle } from '../../../src/features/monitor-display/components/monitorStyles';
import { SlideDots } from '../../../src/features/monitor-display/components/MonitorChrome';
import { sichererBereichStyle } from '../../../src/features/monitor-display/overscan';
import { buildTournament } from '../../../src/features/monitor-display/__tests__/monitorFixture';
import { buildMonitorView } from '../../../src/features/monitor-display/monitorView';
import { PERFORMANCE_PROFILES } from '../../../src/types/monitor';

const q = new URLSearchParams(window.location.search);
const szene = q.get('szene') ?? 'end6';
const seite = Number(q.get('seite') ?? '0');
const thema = q.get('thema') === 'light' ? 'light' : 'dark';
const rand = Number(q.get('rand') ?? '0');

const id = (n: number) => TeamIdSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const KURZ = ['FC Nord', 'SV Süd', 'TSV West', 'SG Mitte', 'SC Ost', 'FC Berg', 'TuS Tal', 'DJK Eck'];
const LANG = [
  'Sportgemeinschaft Rot-Weiß Musterstadt Nord 1904 I', 'Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921', 'Turn- und Sportverein Blau-Schwarz Oberdorf 1890',
  'Fußballclub Hinterzarten Niederbrunnen Obermusterdorf', 'Hinterzarten Niederbrunnen Obermusterdorf Kleinstadt 1', 'Hinterzarten Niederbrunnen Obermusterdorf Kleinstadt 2',
  'Hinterzarten Niederbrunnen Obermusterdorf Kleinstadt 3', 'Hinterzarten Niederbrunnen Obermusterdorf Kleinstadt 4',
];
const anzahl = szene === 'end6' ? 6 : 8;
const namen = (szene === 'lang' ? LANG : KURZ).slice(0, anzahl);
const places = szene === 'geteilt' ? [1, 2, 2, 4, 5, 6] : namen.map((_, i) => i + 1);
const ranking: FinalStandingRow[] = (szene === 'geteilt' ? KURZ.slice(0, 6) : namen).map((teamName, i) => ({
  place: places[i], teamId: id(i + 1), teamName, origin: { kind: 'groupPlace', group: '', place: places[i] },
}));
const spieler = (rank: number, n: number, tore: number, team: number): ScorerRow => ({ kind: 'player', rank, teamId: id(team), teamName: KURZ[team - 1], number: n, goals: tore });
const scorers: ScorerRow[] = [
  spieler(1, 9, 5, 1), spieler(2, 7, 4, 2), spieler(3, 10, 3, 1), spieler(3, 4, 3, 2), spieler(3, 11, 3, 3),
  spieler(6, 2, 2, 4), spieler(6, 8, 2, 5), spieler(6, 5, 2, 6), spieler(9, 3, 1, 7), spieler(9, 6, 1, 8),
  { kind: 'noNumber', rank: null, teamId: id(1), teamName: KURZ[0], goals: 2 }, { kind: 'ownGoals', rank: null, teamId: id(2), teamName: KURZ[1], goals: 1 },
];
const end: MonitorEnd = szene === 'kids'
  ? { kind: 'kids' }
  : { kind: 'final', finishedAt: '2026-11-28T13:10:00+01:00', ranking, scorers: szene === 'tor' || szene === 'tor2' ? scorers : null };
const folie = szene === 'tor' || szene === 'tor2' ? END_SCORERS_SLIDE : END_STANDINGS_SLIDE;
const turnier = buildTournament({ title: 'Nikolaus-Turnier 2026', lifecycleStatus: 'finished' });
const view = buildMonitorView(turnier);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={anzeigeI18n()}>
    <div style={{ ...containerStyle, containerType: 'size' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'size' }} data-testid="monitor-slide">
        <SlideRenderer
          slide={folie} tournament={turnier} view={view} performanceSettings={PERFORMANCE_PROFILES.high} theme={thema}
          overscanPercent={rand} page={szene === 'tor2' ? Math.max(seite, 1) : seite} end={end}
        />
      </div>
      {/* Positionspunkte wie auf der Monitor-Seite (im sicheren Bereich, unten): die Folie darf sie nicht überdecken */}
      <div style={sichererBereichStyle(rand)}><SlideDots count={3} currentIndex={0} enableTransitions={false} /></div>
    </div>
  </I18nextProvider>,
);
