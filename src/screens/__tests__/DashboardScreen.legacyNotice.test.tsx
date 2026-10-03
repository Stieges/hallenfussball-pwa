/**
 * A-05 Fixrunde 1 (@FU-007): Der Altformat-Hinweis kommt im Dashboard an. Kette: Altformat im lokalen Speicher
 * -> LocalStorageRepository.loadList legt es beiseite und meldet das Ereignis -> DashboardScreen zeigt den Hinweis.
 * Ohne das Ereignis erschiene er nur, wenn das Laden vor dem Einhaengen der Komponente fertig waere.
 */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IStorageAdapter } from '../../core/storage/IStorageAdapter';

const data = new Map<string, unknown>();
vi.mock('../../core/storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(data.get(key) ?? null),
      set: (key: string, value: unknown) => {
        data.set(key, structuredClone(value));
        return Promise.resolve();
      },
    } as unknown as IStorageAdapter),
}));
vi.mock('../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../features/auth/hooks/useTournamentLimit', () => ({
  useTournamentLimit: () => ({ canCreate: true, isAtLimit: false, isNearLimit: false, isLimited: false }),
  ANONYMOUS_TOURNAMENT_LIMIT: 3,
}));

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null, isAuthenticated: false, isGuest: true, isLoading: false, isOnline: true,
    connectionState: 'online', logout: vi.fn(), reconnect: vi.fn(),
  }),
}));

import { DashboardScreen } from '../DashboardScreen';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';

const noop = vi.fn();
const props = {
  tournaments: [],
  onCreateNew: noop,
  onTournamentClick: noop,
  onDeleteTournament: noop,
  onImportTournament: noop,
  onSoftDelete: noop,
  onRestore: noop,
  onPermanentDelete: noop,
  onCopyTournament: noop,
  onNavigateToLogin: noop,
  onNavigateToRegister: noop,
  onNavigateToProfile: noop,
  onNavigateToSettings: noop,
};

describe('DashboardScreen – Altformat-Hinweis (@FU-007)', () => {
  beforeEach(() => data.clear());

  it('@FU-007 Altformat wird beim Laden beiseitegelegt und der Hinweis erscheint im Dashboard (Ereignis)', async () => {
    render(<MemoryRouter><DashboardScreen {...props} /></MemoryRouter>);
    expect(screen.queryByTestId('legacy-tournament-notice')).toBeNull();

    data.set('tournaments', [{ id: 'alt', title: 'Alt', matches: [{ id: 'm1', teamA: 'FC Nord', teamB: 'FC Sued' }] }]);
    await act(async () => { await new LocalStorageRepository().listForCurrentUser(); });

    expect(await screen.findByTestId('legacy-tournament-notice')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ein gueltiges Turnier loest keinen Hinweis aus', async () => {
    render(<MemoryRouter><DashboardScreen {...props} /></MemoryRouter>);
    data.set('tournaments', []);
    await act(async () => { await new LocalStorageRepository().listForCurrentUser(); });
    expect(screen.queryByTestId('legacy-tournament-notice')).toBeNull();
  });
});
