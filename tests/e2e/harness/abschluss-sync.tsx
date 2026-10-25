/**
 * Prüfstand R3-2a (Regel T2-UI): die drei Texte nach dem Turnierabschluss, die offline nicht erreichbar sind (sie brauchen ein
 * Konto, einen abgeschlossenen Turnierstand am Server und gescheiterte Übertragungen). Echte Komponenten, echte Design-Tokens,
 * echte i18n, Hell/Dunkel über den echten ThemeProvider. Nur Testumgebung, nicht Teil des Builds.
 * Adresse: `?ansicht=liste|hinweis|uebernahme` (`&sprache=en`).
 * - liste: Liste gestörter Übertragungen mit „Nicht übernommen – Turnier ist abgeschlossen“ (@HE-070, @FU-057)
 * - hinweis: Hinweis im Cockpit „Turnier ist abgeschlossen – 2 Einträge an die Turnierleitung übergeben“ (@FU-018)
 * - uebernahme: Rückfrage „Spielleitung übernehmen?“ nach der Ablehnung, Haupttaste gesperrt (Plan H-9)
 */
import ReactDOM from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { SyncFailedList } from '../../../src/features/collaboration/components/SyncFailedList';
import { OutboxNotice } from '../../../src/features/collaboration/outbox/OutboxNotice';
import { TakeoverDialog } from '../../../src/components/dialogs/TakeoverDialog';
import { emptyOutboxStatus } from '../../../src/core/match/client/outboxTypes';
import type { FailedMutationItem } from '../../../src/core/services/MutationQueue';

const query = new URLSearchParams(window.location.search);
const ansicht = query.get('ansicht') ?? 'liste';
void i18n.changeLanguage(query.get('sprache') === 'en' ? 'en' : 'de');

const abgelehnt: FailedMutationItem = {
  id: 'r3-2a-1',
  type: 'UPDATE_MATCHES',
  payload: { tournamentId: 'live-cup', updates: [{ id: 'finale' }] },
  timestamp: Date.now() - 60000,
  retryCount: 0,
  failedAt: Date.now() - 30000,
  lastError: 'Match finale: TOURNAMENT_FINISHED: Turnier ist abgeschlossen (matches, Turnier live-cup).',
  rejection: 'tournamentFinished',
};

// eslint-disable-next-line react-refresh/only-export-components -- Prüfstand, kein Teil der App (keine Schnellaktualisierung nötig)
function Uebernahme() {
  const { t } = useTranslation('cockpit');
  return (
    <TakeoverDialog isOpen feldName="Feld 2" halter="Tom (Handy)" busy fehler={t('steuer.turnierAbgeschlossen')} onConfirm={() => undefined} onCancel={() => undefined} />
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Prüfstand, kein Teil der App (keine Schnellaktualisierung nötig)
function Pruefstand() {
  if (ansicht === 'hinweis') {
    return (
      <div style={{ padding: cssVars.spacing.md }}>
        <OutboxNotice status={{ ...emptyOutboxStatus(), reviewByMatch: { finale: 2 }, afterFinishByMatch: { finale: 2 } }} matchId="finale" onReload={() => undefined} />
      </div>
    );
  }
  if (ansicht === 'uebernahme') {
    return <Uebernahme />;
  }
  // Wie im Kopf der App: die Liste hängt an der Sync-Anzeige (Elternelement), rechtsbündig.
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: cssVars.spacing.md, borderBottom: `1px solid ${cssVars.colors.border}` }}>
      <div style={{ position: 'relative', padding: cssVars.spacing.sm, color: cssVars.colors.error }}>
        {i18n.t('common:syncStatus.failedListTitle')}
        <SyncFailedList items={[abgelehnt]} onRetry={() => undefined} onDiscard={() => undefined} onClose={() => undefined} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <div style={{ background: cssVars.colors.background, minHeight: '100vh' }}>
      <Pruefstand />
    </div>
  </ThemeProvider>,
);
