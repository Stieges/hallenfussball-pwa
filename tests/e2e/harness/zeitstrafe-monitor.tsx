/**
 * Prüfstand Zeitstrafe am Monitor (Regel T2-UI, Befund C-ZEITSTRAFE-GEGENTOR-FEHLT): ECHTE Live-Folie (`SlideRenderer` → `LiveSlide`) mit Tokens, fester
 * Anzeigesprache und fester Serverzeit; ersetzt ist nur die Server-Antwort (feste Ereignisse und Uhr), weil Server und Cloud offline fehlen.
 * Spiel 7 „FC Nord – SV Süd“, SV Süd hat seit 3:20 eine Zeitstrafe von 2 Minuten für die Nummer 5, FC Nord erzielt 30 Sekunden später ein Tor.
 * Adresse: `?szene=vorGegentor|nachGegentor|regelAus|liveStandAus`. Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import { I18nextProvider } from 'react-i18next';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { anzeigeI18n } from '../../../src/i18n/anzeigeSprache';
import type { RuntimeMatchEvent } from '../../../src/types/tournament';
import { SlideRenderer } from '../../../src/features/monitor-display/slides/SlideRenderer';
import { containerStyle } from '../../../src/features/monitor-display/components/monitorStyles';
import { NowSourceContext } from '../../../src/components/schedule/useTickingNow';
import { buildTournament, slide, withMatch } from '../../../src/features/monitor-display/__tests__/monitorFixture';
import { buildMonitorView } from '../../../src/features/monitor-display/monitorView';
import { PERFORMANCE_PROFILES } from '../../../src/types/monitor';

const szene = new URLSearchParams(window.location.search).get('szene') ?? 'nachGegentor';
const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const START_5 = 200_000;

const strafe: RuntimeMatchEvent = {
  id: 's5', type: 'TIME_PENALTY', timestampSeconds: 200, clockMs: START_5,
  payload: { teamId: 'team-sued', playerNumber: 5, durationSeconds: 120, ...(szene === 'regelAus' ? { endsOnGoal: false } : {}) },
  scoreAfter: { home: 1, away: 0 },
};
const tor: RuntimeMatchEvent = { id: 'tor', type: 'GOAL', timestampSeconds: 230, clockMs: START_5 + 30_000, payload: { teamId: 'team-nord' }, scoreAfter: { home: 2, away: 0 } };
const gespielt = START_5 + (szene === 'vorGegentor' ? 20_000 : 40_000);
const liveState = { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, sectionStartMs: 0, elapsedMs: gespielt, anchorAt: T0 };
const events = szene === 'vorGegentor' ? [strafe] : [strafe, tor];

const turnier = buildTournament({
  matches: withMatch('match-7', { events, liveState, scoreA: szene === 'vorGegentor' ? 1 : 2 }),
  ...(szene === 'liveStandAus' ? { publicLiveScore: false } : {}),
});
const view = buildMonitorView(turnier);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={anzeigeI18n()}>
    <NowSourceContext.Provider value={() => T0}>
      <div style={{ ...containerStyle, containerType: 'size' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'size' }} data-testid="monitor-slide">
          <SlideRenderer slide={slide('live', { fieldId: 'field-1' })} tournament={turnier} view={view} performanceSettings={PERFORMANCE_PROFILES.high} theme="dark" overscanPercent={0} />
        </div>
      </div>
    </NowSourceContext.Provider>
  </I18nextProvider>,
);
