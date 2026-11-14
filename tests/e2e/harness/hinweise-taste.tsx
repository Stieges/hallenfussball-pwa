/**
 * Prüfstand für „Hinweise tragen die Taste, die das Problem löst“ (@OB-087, @OB-088): die ECHTEN Bausteine, die es auch im Stand vor der Änderung
 * gibt (so entstehen die Bilder „vorher“ und „nachher“ mit gleichen Daten): die Zuschauer-Fehleransicht mit dem echten `usePublicTournament` und einer
 * gestellten Quelle, der Ausgangs-Hinweis „Bitte neu anmelden“ und der Hinweis „App aktualisieren“ als Meldung. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=zuschauer|anmelden|aktualisieren` (+ `&lang=en`, `&phase=vorher` für den Stand ohne Taste, wo der Baustein es kennt).
 * - zuschauer: die Quelle scheitert, bis `hin.netz` auf `true` steht (und danach `online` kommt oder die Taste getippt wird);
 *   `hin.abrufe` zählt die Abrufe. Die Seite wird nie neu geladen (Marke in `window`).
 */
import ReactDOM from 'react-dom/client';
import { useEffect } from 'react';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { HashRouter, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { ToastProvider, useToast } from '../../../src/components/ui/Toast';
import { cssVars } from '../../../src/design-tokens';
import { OutboxNotice } from '../../../src/features/collaboration/outbox/OutboxNotice';
import { emptyOutboxStatus } from '../../../src/core/match/client/outboxTypes';
import { usePublicTournament } from '../../../src/features/public-view/usePublicTournament';
import { PublicErrorView } from '../../../src/features/public-view/components/PublicStatusViews';
import type { PublicTournamentSource } from '../../../src/features/public-view/publicSource';

/** Zähler und Schalter für den Test (`window.__hinweise`); ohne globale Typdeklaration, damit die beiden Prüfstände sich nicht stören. */
const hin = { netz: false, abrufe: 0, zumAnmelden: 0, aktualisiert: 0 };
(window as unknown as { __hinweise: typeof hin }).__hinweise = hin;

const query = new URLSearchParams(window.location.search);
if (query.get('lang') === 'en') { void i18n.changeLanguage('en'); }
const fall = query.get('fall') ?? 'zuschauer';
const vorher = query.get('phase') === 'vorher';

const quelle: PublicTournamentSource = {
  kind: 'legacy', pollIntervalMs: null, nowMs: () => Date.now(),
  fetch: () => {
    hin.abrufe += 1;
    return Promise.resolve(hin.netz ? { kind: 'unchanged' as const, version: 'v1' } : { kind: 'unreachable' as const });
  },
};

export function Zuschauer() {
  const state = usePublicTournament('NORD28', quelle, { storage: null });
  if (state.loadingState === 'error') { return <PublicErrorView errorMessage={state.errorMessage} onRetry={state.refresh} />; }
  return <p data-testid="zuschauer-geladen" style={{ padding: cssVars.spacing.lg, color: cssVars.colors.textPrimary }}>{state.loadingState === 'loading' ? '…' : 'Spielplan geladen'}</p>;
}

export function Anmelden() {
  const navigate = useNavigate();
  const status = { ...emptyOutboxStatus(), authRequired: true, pendingByMatch: { 'match-11': 3 } };
  return (
    <div style={{ padding: cssVars.spacing.md }}>
      <OutboxNotice
        status={status} matchId="match-11" onReload={() => undefined}
        {...(vorher ? {} : { onLogin: () => { hin.zumAnmelden += 1; void navigate('/login'); } })}
      />
    </div>
  );
}

export function Aktualisieren() {
  const { showWarning } = useToast();
  useEffect(() => {
    const text = i18n.t('common:outbox.notice.clientOutdated');
    if (vorher) { showWarning(text, { duration: 0 }); return; }
    showWarning(text, { duration: 0, action: { label: i18n.t('common:outbox.notice.reloadNow'), onClick: () => { hin.aktualisiert += 1; } } });
  }, [showWarning]);
  return <p style={{ padding: cssVars.spacing.lg, color: cssVars.colors.textPrimary }}>Spielplan</p>;
}

export function Seite() {
  const body = fall === 'anmelden' ? <Anmelden /> : fall === 'aktualisieren' ? <Aktualisieren /> : <Zuschauer />;
  return <div style={{ minHeight: '100vh', background: cssVars.colors.background }}>{body}</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><ThemeProvider><ToastProvider><Seite /></ToastProvider></ThemeProvider></HashRouter>);
