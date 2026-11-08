/**
 * Prüfstand Paket M „Monitor-Stabilität“ (Regel T2-UI): die GANZE Monitor-Seite (`MonitorDisplayPage`: Lade-Hook, Hinweis, Uhr, Folien) mit den
 * echten Namen des Nikolaus-Wochenendes und einer eingespeisten Datenquelle, deren „Netz“ der Test schaltet (`window.__netz`):
 * `true` = Antwort „unverändert“, `false` = der Abruf scheitert, `'haengt'` = der Abruf kommt erst nach der Zeitgrenze von 4 s zurück, ohne Antwort (eingefrorene Verbindung).
 * Server und Cloud fehlen offline; die Antwort des echten Servers prüfen die Vitest-Tests über `getForDisplay`. Nur Testumgebung.
 * Adresse: `?szene=live|lang|tabelle|naechste` und `rand=<Prozent>`; die Uhr (Date) setzt der Test vor dem Laden (Playwright-Uhr).
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { MonitorDisplayPage } from '../../../src/features/monitor-display/MonitorDisplayPage';
import type { DisplayDelta, MonitorDataSource } from '../../../src/features/monitor-display/monitorDataSource';
import { attachMonitor, slide, withMonitor } from '../../../src/features/monitor-display/__tests__/monitorFixture';
import { LANGE_NAMEN, listenTurnier } from '../../../src/features/monitor-display/__tests__/listFolienKit';
import type { Tournament } from '../../../src/types/tournament';

declare global {
  interface Window { __netz: boolean | 'haengt'; __neu: 0 | 1 | 2; __anfragen: number }
}

const szene = new URLSearchParams(window.location.search).get('szene') ?? 'live';
/** Die sechs Teams der Gruppe „G“ (Nikolausturnier, `turnierwochenende/g.json`); der längste echte Name ist „SV Kirchanschöring“. */
const NIKOLAUS_G = ['SV Kirchanschöring', 'TSV Waging 1', 'TSV Palling', 'DJK Otting', 'TSV Petting', 'TSV Waging 2'];
const T0 = Date.now();

const LISTE = szene === 'plan' || szene === 'planlang' || szene === 'tabellelang';
const LANG = szene === 'lang' || szene === 'planlang' || szene === 'tabellelang';

/** Die Monitor-Seite mit den Daten: `neu` 0 = Spiel 1 läuft (1:0), 1 = Spiel 1 läuft (2:0), 2 = Spiel 1 beendet 2:1, Spiel 2 läuft. */
function baue(neu: 0 | 1 | 2 = 0): Tournament {
  // „naechste“ und die Listen-Folien: fünf Spiele beendet, ab Spiel 7 um 10 Minuten verschoben („(war hh:mm)“); sonst Turnierbeginn ohne gespieltes Spiel
  const basis = listenTurnier(szene === 'naechste' || LISTE ? { beendet: 5, verschoben: true } : { beendet: 0 });
  const namen = LANG ? LANGE_NAMEN : NIKOLAUS_G;
  const teams = basis.teams.map((t, i) => ({ ...t, name: namen[i] }));
  const folie = szene === 'tabelle' || szene === 'tabellelang' ? slide('all-standings')
    : szene === 'plan' || szene === 'planlang' ? slide('schedule-field', { fieldId: 'field-1' })
      : szene === 'naechste' ? slide('next-matches', { matchCount: 5 })
        : slide('live', { fieldId: 'field-1' });
  const mitMonitor = attachMonitor({ ...basis, teams }, withMonitor({ id: 'mon-1', slides: [folie] }));
  if (szene !== 'live' && szene !== 'lang') { return mitMonitor; }
  // Das laufende Spiel läuft seit 4:00 von 10:00 (Serverzeit = Geräteuhr)
  const liveState = {
    status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, overtimeSeconds: 0,
    sectionStartMs: 0, elapsedMs: 0, anchorAt: T0 - 4 * 60_000, breakStartedAt: null, breakSeconds: 0,
  };
  return {
    ...mitMonitor,
    matches: mitMonitor.matches.map((m) => {
      if (neu === 2 && m.matchNumber === 1) { return { ...m, matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular' }; }
      if (neu === 2 && m.matchNumber === 2) { return { ...m, matchStatus: 'running', scoreA: 0, scoreB: 0, liveState: { ...liveState, anchorAt: T0 } }; }
      if (neu < 2 && m.matchNumber === 1) { return { ...m, matchStatus: 'running', scoreA: neu === 1 ? 2 : 1, scoreB: 0, liveState }; }
      return m;
    }),
  };
}

const stand = (neu: 0 | 1 | 2, version: string): DisplayDelta => {
  const t = baue(neu);
  return { kind: 'snapshot', version, tournament: t, monitor: t.monitors?.[0] ?? null, origin: 'cloud', lookupFailed: false };
};
const turnier = baue();
window.__netz = true;
window.__neu = 0;
window.__anfragen = 0;
/** Welche Daten der Monitor zuletzt bekam (`null` = noch keine); eine Änderung von `window.__neu` kommt mit der nächsten Antwort an */
let ausgeliefert: 0 | 1 | 2 | null = null;

const quelle: MonitorDataSource = {
  nowMs: () => Date.now(),
  async fetch(): Promise<DisplayDelta> {
    window.__anfragen += 1;
    // Die echte Quelle begrenzt jeden Abruf auf 4 s (CLOUD_TIMEOUT_MS) und fällt dann auf die lokale Kopie zurück (hier: keine → Fehler)
    if (window.__netz === 'haengt') { return new Promise<DisplayDelta>((_, nein) => { setTimeout(() => { nein(new Error('Zeitgrenze')); }, 4_000); }); }
    if (!window.__netz) { throw new Error('kein Netz'); }
    const gewollt = ausgeliefert === null ? 0 : window.__neu;
    if (gewollt === ausgeliefert) { return { kind: 'unchanged' }; }
    ausgeliefert = gewollt;
    return stand(gewollt, String(gewollt + 1));
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <MonitorDisplayPage tournamentId={turnier.id} monitorId="mon-1" dataSource={quelle} />,
);
