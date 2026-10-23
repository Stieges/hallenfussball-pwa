/**
 * Review A-11 A4 (@FU-098): Der RepositoryProvider gibt der Rechte-Frage die Sync-Quelle des angemeldeten Kontos
 * (OfflineRepository) -- im Gastmodus keine (dort ist jeder Eigentümer, Zweig „nicht angemeldet“).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- RepositoryContext ist eine bewusste React-Bridge; Test über React Testing Library.
import { render } from '@testing-library/react';

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: vi.fn(),
    from: vi.fn(),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) },
  },
}));

import { RepositoryProvider } from '../RepositoryContext';
import {
  getActiveTournamentSyncSource,
  setActiveTournamentSyncSource,
} from '../../repositories/activeTournamentSyncSource';

afterEach(() => {
  setActiveTournamentSyncSource(null);
});

describe('RepositoryProvider – Sync-Quelle für die Rechte-Frage (@FU-098)', () => {
  it('@FU-098 angemeldetes Konto: die Quelle ist gesetzt und kennt kein unbekanntes Turnier als „angelegt, nicht in der Cloud“', async () => {
    render(<RepositoryProvider user={{ id: 'olli', globalRole: 'user' }}><span /></RepositoryProvider>);

    const source = getActiveTournamentSyncSource();
    expect(source).not.toBeNull();
    expect(await source?.isAwaitingFirstUpload('gibt-es-nicht')).toBe(false);
  });

  it('Gegenbeispiel: Gastmodus setzt keine Quelle', () => {
    setActiveTournamentSyncSource({ isAwaitingFirstUpload: async () => true, subscribe: () => () => undefined });

    render(<RepositoryProvider user={{ id: 'gast', globalRole: 'guest' }}><span /></RepositoryProvider>);

    expect(getActiveTournamentSyncSource()).toBeNull();
  });
});
