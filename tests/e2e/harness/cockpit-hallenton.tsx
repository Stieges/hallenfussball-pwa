/**
 * Prüfstand für H4-12: das echte Live-Cockpit (`LiveCockpit`) mit den Hinweisen zum Hallen-Lautsprecher unter der Tafel, dem Cockpit-Dialog
 * „Ton dieses Geräts“ und das echte Panel des Admin „Match Cockpit“ ohne Tonteil. Der Zustand kommt aus den echten Funktionen: die Hinweise aus
 * einer echten Leitung (`erzeugeLeitungLebenszeichen`) mit gefälschtem Server-Aufruf, der Ton je Gerät aus `useCockpitTon` (echter `localStorage`).
 * Daten wie im Mockup: Hallencup Süd, Feld 1, Spiel 11, FC Nord – SV Süd, 14:02. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=kein-netz|lautsprecher-aus|anpfiff|ausgang-geaendert|dialog|admin|ohne` (+ `&lang=en`, `&lang=de`).
 */
import ReactDOM from 'react-dom/client';
import { useEffect, useState } from 'react';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { HashRouter } from 'react-router-dom';
import { AuthContext } from '../../../src/features/auth/context/authContextInstance';
import type { AuthContextValue } from '../../../src/features/auth/context/authContextValue';
import { RepositoryProvider } from '../../../src/core/contexts/RepositoryContext';
import { ToastProvider } from '../../../src/components/ui/Toast';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { LiveCockpit } from '../../../src/components/live-cockpit/LiveCockpit';
import { MatchCockpitSettingsPanel } from '../../../src/components/match-settings/MatchCockpitSettingsPanel';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../src/types/tournament';
import type { LiveCockpitProps } from '../../../src/components/live-cockpit/types';
import type { LiveMatch } from '../../../src/core/models/LiveMatch';
import { setzeLeitung } from '../../../src/features/hallenton/leitungGeraet';
import { erzeugeLeitungLebenszeichen } from '../../../src/features/hallenton/runtime/leitungLebenszeichen';
import { echterZeitgeber } from '../../../src/features/hallenton/runtime/zeitgeber';

// Angemeldeter Helfer (Tom): die Hülle des Cockpits braucht Anmeldung, Ablage und Meldungen als Umgebung
const angemeldet = { user: { id: 'tom', name: 'Tom', email: 'tom@example.org' }, isAuthenticated: true, isGuest: false, isLoading: false, connectionState: 'online', reconnect: () => Promise.resolve(true) } as unknown as AuthContextValue;
const TID = 'hallencup-sued';
const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const FAELLE = ['kein-netz', 'lautsprecher-aus', 'anpfiff', 'ausgang-geaendert', 'dialog', 'admin', 'ohne'] as const;
type Fall = (typeof FAELLE)[number];

function antwort(state: 'ready' | 'not_activated', ageMs: number, hint: boolean) {
  return { ok: true as const, status: 'ok' as const, serverNow: SERVER_JETZT, speaker: { state, ageMs, outputHint: hint } };
}

type LeitungRpc = Parameters<typeof erzeugeLeitungLebenszeichen>[0]['rpc'];

/** Eine echte Leitung mit gefälschtem Server: je Fall die Antwort; „kein Netz“ = erste Antwort gut, danach scheitert jeder Versuch. */
function starteLeitung(fall: Fall): void {
  let aufrufe = 0;
  const rpc: LeitungRpc = () => {
    aufrufe += 1;
    switch (fall) {
      case 'kein-netz': return Promise.resolve(aufrufe === 1 ? antwort('ready', 1000, false) : { ok: false as const, grund: 'netz' as const });
      case 'lautsprecher-aus': return Promise.resolve(antwort('ready', 12_000, false)); // meldet sich seit 14:02 nicht mehr
      case 'anpfiff': return Promise.resolve(antwort('not_activated', 1000, false));
      case 'ausgang-geaendert': return Promise.resolve(antwort('ready', 1000, true));
      default: return Promise.resolve({ ok: true as const, status: 'not_controller' as const, serverNow: SERVER_JETZT, speaker: null });
    }
  };
  const leitung = erzeugeLeitungLebenszeichen({
    deviceId: 'handy-tom', eigeneFelder: () => ({ [TID]: [1] }), angepfiffen: () => true, rpc, zeitgeber: echterZeitgeber,
  });
  setzeLeitung(leitung);
  leitung.start();
}

const spiel = (status: LiveMatch['status']): LiveMatch => ({
  id: 'match-11', number: 11, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
  scheduledKickoff: new Date(2026, 10, 21, 14, 2).toISOString(), durationSeconds: 600,
  homeTeam: { id: 'fc-nord', name: 'FC Nord' }, awayTeam: { id: 'sv-sued', name: 'SV Süd' },
  homeScore: status === 'NOT_STARTED' ? 0 : 2, awayScore: status === 'NOT_STARTED' ? 0 : 1, status, elapsedSeconds: status === 'NOT_STARTED' ? 0 : 192,
  playPhase: 'regular', events: [], retractedEvents: [],
}) as unknown as LiveMatch;

const nichts = (): undefined => undefined;
const props = (match: LiveMatch): LiveCockpitProps => ({
  fieldName: 'Feld 1', tournamentName: 'Hallencup Süd', tournamentId: TID, currentMatch: match, upcomingMatches: [], kannSteuern: true,
  onStart: nichts, onPause: nichts, onResume: nichts, onFinish: () => true, onGoal: nichts, onLoadNextMatch: nichts,
  onUpdateSettings: nichts,
} as unknown as LiveCockpitProps);

export function Seite() {
  const params = new URLSearchParams(window.location.search);
  const fall = FAELLE.find((f) => f === params.get('fall')) ?? 'ohne';
  const [bereit, setBereit] = useState(false);
  useEffect(() => {
    if (fall !== 'admin' && fall !== 'dialog') { starteLeitung(fall); }
    setBereit(true);
  }, [fall]);
  if (!bereit) { return null; }
  if (fall === 'admin') {
    return (
      <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.background, color: cssVars.colors.textPrimary, minHeight: '100vh' }} data-testid="admin-panel">
        <MatchCockpitSettingsPanel settings={DEFAULT_MATCH_COCKPIT_SETTINGS} onChange={nichts} tournamentId={TID} onTestSound={nichts} />
      </div>
    );
  }
  const status = fall === 'anpfiff' ? 'NOT_STARTED' : fall === 'dialog' ? 'PAUSED' : 'RUNNING';
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: cssVars.colors.background }}>
      <LiveCockpit {...props(spiel(status))} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><AuthContext.Provider value={angemeldet}><ThemeProvider><RepositoryProvider user={null}><ToastProvider><Seite /></ToastProvider></RepositoryProvider></ThemeProvider></AuthContext.Provider></HashRouter>);
