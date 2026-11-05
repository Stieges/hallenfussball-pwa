/**
 * Prüfstand Monitor-Listen-Folien „Spielplan Feld 1“ und „Nächste Spiele“ (Regel T2-UI; @ZM-187, @ZM-188, @ZM-185): ECHTE Folien-Komponente
 * (`SlideRenderer`), Design-Tokens, feste Anzeigesprache, Rahmen wie die Monitor-Seite. Turnier aus dem Kit `listFolienKit` (6 Teams,
 * 15 Spiele auf Feld 1). Nur Testumgebung, nicht Teil des Builds.
 * Adresse: `?szene=plan|naechste|finale&seite=<n>&namen=kurz|lang|bindestrich&verschoben=1&gewertet=1&strafstoss=1&rand=<Prozent>&anzahl=<Spiele>`.
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import { I18nextProvider } from 'react-i18next';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { anzeigeI18n } from '../../../src/i18n/anzeigeSprache';
import { SlideRenderer } from '../../../src/features/monitor-display/slides/SlideRenderer';
import { containerStyle } from '../../../src/features/monitor-display/components/monitorStyles';
import { buildMonitorView } from '../../../src/features/monitor-display/monitorView';
import { nameCharsPerLine } from '../../../src/features/monitor-display/listRows';
import { monitorPageCount } from '../../../src/features/monitor-display/slideContent';
import { listenTurnier } from '../../../src/features/monitor-display/__tests__/listFolienKit';
import { PERFORMANCE_PROFILES } from '../../../src/types/monitor';
import type { MonitorSlide } from '../../../src/types/monitor';

const q = new URLSearchParams(window.location.search);
const szene = q.get('szene') === 'naechste' ? 'naechste' : q.get('szene') === 'finale' ? 'finale' : 'plan';
const seite = Number(q.get('seite') ?? '0');
const rand = Number(q.get('rand') ?? '5');
const anzahl = Number(q.get('anzahl') ?? '15');

const turnier = listenTurnier({
  namen: q.get('namen') === 'lang' ? 'lang' : q.get('namen') === 'bindestrich' ? 'bindestrich' : 'kurz', verschoben: q.get('verschoben') === '1', gewertet: q.get('gewertet') === '1', strafstoss: q.get('strafstoss') === '1', finale: Number(q.get('finale') ?? '0'),
});
const view = buildMonitorView(turnier);
const folie = (szene === 'finale'
  ? { id: 'finale', type: 'all-standings', config: {}, duration: null, order: 0 }
  : szene === 'plan'
  ? { id: 'plan', type: 'schedule-field', config: { fieldId: 'field-1' }, duration: null, order: 0 }
  : { id: 'naechste', type: 'next-matches', config: { matchCount: anzahl }, duration: null, order: 0 }) as unknown as MonitorSlide;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={anzeigeI18n()}>
    <div style={{ ...containerStyle, containerType: 'size' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'size' }} data-testid="monitor-slide" data-pages={monitorPageCount(folie, turnier, view, undefined, { overscan: rand, notice: false })} data-namechars={nameCharsPerLine({ overscan: rand, notice: false })}>
        <SlideRenderer slide={folie} tournament={turnier} view={view} performanceSettings={PERFORMANCE_PROFILES.high} theme="dark" overscanPercent={rand} page={seite} />
      </div>
    </div>
  </I18nextProvider>,
);
