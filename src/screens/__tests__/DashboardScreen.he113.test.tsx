/**
 * @HE-113 (`2026-09-24_helfer-am-turniertag.md`): Startseite und Turnier-Karte eines Handys ohne Konto. Eine Gerätesitzung
 * (anonym, `isAnonymous`) findet weder „Neues Turnier“ noch „Importieren“ noch „Kopieren“; wer ohne Konto als lokaler Gast
 * arbeitet (kein `isAnonymous`) und ein Konto behalten alles wie bisher. Das Ergebnis hängt nur an der Sitzung, nicht an einer
 * Turnier-Rolle -- es gibt hier nichts, was noch lädt.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('i18next');
vi.unmock('react-i18next');
const session = vi.hoisted((): { value: Record<string, unknown> } => ({ value: {} }));
vi.mock('../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));
vi.mock('../../features/auth/hooks/useTournamentLimit', () => ({
  useTournamentLimit: () => ({ canCreate: true, isAtLimit: false, isNearLimit: false, isLimited: false }),
  ANONYMOUS_TOURNAMENT_LIMIT: 3,
}));
vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    isLoading: false, isOnline: true, connectionState: 'online', logout: vi.fn(), reconnect: vi.fn(), ...session.value,
  }),
}));

import { initRealDeI18n } from '../../test/realDeI18n';
import { DashboardScreen } from '../DashboardScreen';
import { scheduleTournament } from '../../test/scheduleEngineHarness';

await initRealDeI18n();

const noop = vi.fn();
const tournament = { ...scheduleTournament(), myRole: undefined };
const props = {
  tournaments: [tournament],
  onCreateNew: noop, onTournamentClick: noop, onDeleteTournament: noop,
  onImportTournament: vi.fn(() => Promise.resolve()), onContinueImport: noop,
  onSoftDelete: noop, onRestore: noop, onPermanentDelete: noop, onCopyTournament: noop,
  onNavigateToLogin: noop, onNavigateToRegister: noop, onNavigateToProfile: noop, onNavigateToSettings: noop,
};

const ANONYM = { user: { id: 'geraet-1', isAnonymous: true, globalRole: 'user', name: 'Olli' }, isAuthenticated: true, isGuest: false, isAnonymous: true };
const LOKALER_GAST = { user: { id: 'guest', isAnonymous: false, globalRole: 'guest', name: 'Gast' }, isAuthenticated: false, isGuest: true, isAnonymous: false };
const KONTO = { user: { id: 'olli', isAnonymous: false, globalRole: 'user', name: 'Olli' }, isAuthenticated: true, isGuest: false, isAnonymous: false };

async function renderDashboard() {
  render(<MemoryRouter><DashboardScreen {...props} /></MemoryRouter>);
  await userEvent.setup().click(await screen.findByTestId(`tournament-${tournament.id}-actions-trigger`));
}

beforeEach(() => { session.value = {}; });

describe('@HE-113 Startseite einer Gerätesitzung ohne Konto', () => {
  it('@HE-113 anonym: weder „Neues Turnier“ noch „Importieren“ noch „Kopieren“; „Öffnen“ bleibt', async () => {
    session.value = ANONYM;
    await renderDashboard();
    expect(screen.queryByRole('button', { name: /Neues Turnier/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-import-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-menu-item-copy')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-menu-item-open')).toBeInTheDocument();
  });

  it.each([['lokaler Gast', LOKALER_GAST], ['Konto (Turnierleitung)', KONTO]])('@HE-113 Gegenbeispiel %s: Anlegen, Importieren, Kopieren wie bisher', async (_n, s) => {
    session.value = s;
    await renderDashboard();
    expect(screen.getByRole('button', { name: /Neues Turnier/ })).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-import-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('action-menu-item-copy')).toBeInTheDocument();
  });
});
