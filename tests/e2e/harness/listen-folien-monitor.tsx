/**
 * Prüfstand Monitor-Listen-Folien „Spielplan Feld 1“ und „Nächste Spiele“ (Regel T2-UI; @ZM-187, @ZM-188, @ZM-185): ECHTE Folien-Komponente
 * (`SlideRenderer`), Design-Tokens, feste Anzeigesprache, Rahmen wie die Monitor-Seite. Turnier aus dem Kit `listFolienKit` (6 Teams,
 * 15 Spiele auf Feld 1). Nur Testumgebung, nicht Teil des Builds.
 * Adresse: `?szene=plan|naechste|finale&seite=<n>&namen=kurz|lang|bindestrich&verschoben=1&gewertet=1&strafstoss=1&rand=<Prozent>&anzahl=<Spiele>&namenliste=a|b|c&felder=2&feldname=<Text>`.
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
import { monitorPageCount, nextMatchesLayout, scheduleFieldLayout } from '../../../src/features/monitor-display/slideContent';
import { namenBreiteEm } from '../../../src/features/monitor-display/listCompact';
import { getFieldDisplayName } from '../../../src/utils/displayNames';
import { listenTurnier } from '../../../src/features/monitor-display/__tests__/listFolienKit';
import { PERFORMANCE_PROFILES } from '../../../src/types/monitor';
import type { MonitorSlide } from '../../../src/types/monitor';
import type { Match } from '../../../src/types/tournament';

const q = new URLSearchParams(window.location.search);
const szene = q.get('szene') === 'naechste' ? 'naechste' : q.get('szene') === 'finale' ? 'finale' : 'plan';
const seite = Number(q.get('seite') ?? '0');
const rand = Number(q.get('rand') ?? '5');
const anzahl = Number(q.get('anzahl') ?? '15');

const basis = listenTurnier({
  namen: q.get('namen') === 'lang' ? 'lang' : q.get('namen') === 'bindestrich' ? 'bindestrich' : 'kurz', verschoben: q.get('verschoben') === '1', gewertet: q.get('gewertet') === '1', strafstoss: q.get('strafstoss') === '1', finale: Number(q.get('finale') ?? '0'), felder: q.get('felder') === '2' ? 2 : 1,
});
// `namenliste=a|b|c|d|e|f`: eigene Teamnamen (reihum auf die sechs Teams), z. B. für die Namensbreite (@ZM-211)
const namenliste = (q.get('namenliste') ?? '').split('|').filter(n => n !== '');
const mitNamen = namenliste.length === 0 ? basis : { ...basis, teams: basis.teams.map((t, i) => ({ ...t, name: namenliste[i % namenliste.length] })) };
// `feldname=<Text>`: eigener Name für Feld 2 (nur mit felder=2), Review PR #559 R2
const feldname = q.get('feldname') ?? '';
const mitFeld = feldname === '' ? mitNamen : { ...mitNamen, fields: (mitNamen.fields ?? []).map((f) => (f.id === 'field-2' ? { ...f, customName: feldname } : f)) };
// `zustaende=1`: Spiel 5 beendet und Spiel 6 läuft, beide um 10 Minuten verschoben: Uhrzeit, „(war …)“ und Abzeichen („Ende“, „Live“) übereinander (Review PR #559, S5)
const verschiebe = (m: Match): Match => (m.scheduledTime === undefined ? m : { ...m, scheduledTime: new Date(m.scheduledTime.getTime() + 10 * 60_000), originalStart: m.scheduledTime });
const turnier = q.get('zustaende') !== '1' ? mitFeld : {
  ...mitFeld,
  matches: mitFeld.matches.map((m) => (m.matchNumber === 5 ? verschiebe(m) : m.matchNumber === 6 ? { ...verschiebe(m), matchStatus: 'running' as const, scoreA: 1, scoreB: 0 } : m)),
};
const view = buildMonitorView(turnier);
// Namensbreite der schmalen Aufteilung nach dem Modell (em der Namensschrift); ohne Angabe steht die Folie in der bisherigen Aufteilung (@ZM-211)
const rahmen = { overscan: rand, notice: false, aspect: window.innerWidth / window.innerHeight };
const layout = szene === 'plan' ? scheduleFieldLayout(view, 1, rahmen) : szene === 'naechste' ? nextMatchesLayout(view, anzahl, rahmen, (feld) => getFieldDisplayName(feld, turnier)) : null;
const modellBreite = layout !== null && layout.frame.compact === true ? namenBreiteEm(layout.frame, layout.columns, layout.frame.scale ?? 1) : null;
const folie = (szene === 'finale'
  ? { id: 'finale', type: 'all-standings', config: {}, duration: null, order: 0 }
  : szene === 'plan'
  ? { id: 'plan', type: 'schedule-field', config: { fieldId: 'field-1' }, duration: null, order: 0 }
  : { id: 'naechste', type: 'next-matches', config: { matchCount: anzahl }, duration: null, order: 0 }) as unknown as MonitorSlide;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={anzeigeI18n()}>
    <div style={{ ...containerStyle, containerType: 'size' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'size' }} data-testid="monitor-slide" data-pages={monitorPageCount(folie, turnier, view, undefined, { overscan: rand, notice: false })} data-namebreite-em={modellBreite === null ? undefined : String(modellBreite)} data-namechars={nameCharsPerLine({ overscan: rand, notice: false })}>
        <SlideRenderer slide={folie} tournament={turnier} view={view} performanceSettings={PERFORMANCE_PROFILES.high} theme="dark" overscanPercent={rand} page={seite} />
      </div>
    </div>
  </I18nextProvider>,
);
