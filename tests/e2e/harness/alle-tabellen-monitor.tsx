/**
 * Prüfstand Monitor-Folie „Alle Tabellen“ (Regel T2-UI; @ZM-071, @ZM-177): ECHTE Folien-Komponente (`SlideRenderer`), Design-Tokens, feste
 * Anzeigesprache, Rahmen wie die Monitor-Seite. Das Turnier kommt über die echte Antwortform von `display_tournament` (Kit
 * `publicEntscheidungKit`, Prüfregel @ZM-180), nicht aus einem selbstgebauten Objekt. Nur Testumgebung, nicht Teil des Builds.
 * Adresse: `?szene=<id>&seite=<n>&thema=dark|light&rand=<Prozent>`; ids: jeg (Jeder gegen jeden, der Assistent hat die Standardgruppen
 * A und B gespeichert, die Teams haben keine Gruppe), zwei (zwei echte Gruppen A und B).
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import { I18nextProvider } from 'react-i18next';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { anzeigeI18n } from '../../../src/i18n/anzeigeSprache';
import { parsePublicPayload } from '../../../src/core/repositories/publicPayload';
import { serverAntwort, turnierNordSued, mitStrafstossNord } from '../../../src/core/repositories/__tests__/publicEntscheidungKit';
import { createDefaultGroups } from '../../../src/utils/displayNames';
import type { Tournament } from '../../../src/types/tournament';
import { SlideRenderer } from '../../../src/features/monitor-display/slides/SlideRenderer';
import { containerStyle } from '../../../src/features/monitor-display/components/monitorStyles';
import { SlideDots } from '../../../src/features/monitor-display/components/MonitorChrome';
import { sichererBereichStyle } from '../../../src/features/monitor-display/overscan';
import { buildMonitorView } from '../../../src/features/monitor-display/monitorView';
import { standingsSections } from '../../../src/features/monitor-display/slideContent';
import { PERFORMANCE_PROFILES } from '../../../src/types/monitor';
import type { MonitorSlide } from '../../../src/types/monitor';

const q = new URLSearchParams(window.location.search);
const szene = q.get('szene') ?? 'jeg';
const seite = Number(q.get('seite') ?? '0');
const thema = q.get('thema') === 'light' ? 'light' : 'dark';
const rand = Number(q.get('rand') ?? '0');

const basis = mitStrafstossNord(turnierNordSued());
const lokal: Tournament = szene === 'zwei'
  ? { ...basis, groupSystem: 'groupsAndFinals', numberOfGroups: 2, groups: createDefaultGroups(2), teams: basis.teams.map((t, i) => ({ ...t, group: i % 2 === 0 ? 'A' : 'B' })) }
  : { ...basis, groupSystem: 'roundRobin', numberOfGroups: 2, groups: createDefaultGroups(2) };
const antwort = parsePublicPayload(serverAntwort(lokal, { art: 'gespeichert' }, 'screen'));
if (antwort.kind !== 'full') { throw new Error(antwort.kind); }
const turnier = antwort.tournament;
const view = buildMonitorView(turnier);
const folie = { id: 'alle', type: 'all-standings', config: {}, duration: null, order: 0 } as unknown as MonitorSlide;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={anzeigeI18n()}>
    <div style={{ ...containerStyle, containerType: 'size' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'size' }} data-testid="monitor-slide" data-pages={standingsSections(turnier, view).length}>
        <SlideRenderer slide={folie} tournament={turnier} view={view} performanceSettings={PERFORMANCE_PROFILES.high} theme={thema} overscanPercent={rand} page={seite} />
      </div>
      <div style={sichererBereichStyle(rand)}><SlideDots count={3} currentIndex={0} enableTransitions={false} /></div>
    </div>
  </I18nextProvider>,
);
