/**
 * @FU-109 „Verwerfen ohne erreichbaren Server löscht nichts und lädt den Stand des Servers nach“: der Indikator (Cockpit- und
 * Admin-Kopf) des betroffenen Turniers sagt, dass der Stand des Servers geladen wird, sobald die Verbindung steht. Andere
 * Turniere zeigen den Hinweis nicht. Echte i18next-Instanz (DE/EN).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { emptyOutboxStatus } from '../../../../core/match/client/outboxTypes';

const EMPTY_OUTBOX = emptyOutboxStatus();

vi.unmock('i18next');
vi.unmock('react-i18next');

const hoisted = vi.hoisted(() => ({
  sync: {
    status: 'offline',
    isSyncing: false,
    pendingChanges: 0,
    failedChanges: 0,
    failedMutations: [] as never[],
    isCloudSyncAvailable: true,
    queueLastFailure: null as 'transient' | 'permanent' | 'storage' | null,
    awaitingServerCopyIds: [] as string[],
  },
}));

vi.mock('../../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    ...hoisted.sync,
    syncTournament: vi.fn(),
    retryFailedMutation: vi.fn(),
    discardFailedMutation: vi.fn(),
  }),
}));

vi.mock('../../../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => ({
    sender: {
      getStatus: () => EMPTY_OUTBOX,
      subscribe: () => () => undefined,
    },
  }),
}));

async function renderWithI18n(ui: ReactElement, lng: 'de' | 'en' = 'de') {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common'],
    resources: { de: { common: deCommon }, en: { common: enCommon } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return render(<I18nextProvider i18n={instance}>{ui}</I18nextProvider>);
}

describe('@FU-109 SyncStatusIndicator — nach dem Verwerfen wartet das Gerät auf den Stand des Servers', () => {
  beforeEach(() => {
    hoisted.sync.awaitingServerCopyIds = [];
  });

  it('@FU-109 ohne Verbindung nach dem Verwerfen: klarer Hinweis in DE', async () => {
    hoisted.sync.awaitingServerCopyIds = ['T'];
    await renderWithI18n(<SyncStatusIndicator tournamentId="T" />);

    const hinweis = screen.getByTestId('sync-awaiting-server-copy');
    expect(hinweis.textContent).toBe('Verworfen – der Stand des Servers wird geladen, sobald die Verbindung steht');
    expect(hinweis.getAttribute('role')).toBe('status');
  });

  it('@FU-109 derselbe Hinweis in EN', async () => {
    hoisted.sync.awaitingServerCopyIds = ['T'];
    await renderWithI18n(<SyncStatusIndicator tournamentId="T" />, 'en');

    expect(screen.getByTestId('sync-awaiting-server-copy').textContent).toBe('Discarded – the state of the server will load once the connection is back');
  });

  it('Gegenbeispiel: ist der Stand des Servers übernommen (nichts gemerkt), erscheint kein Hinweis', async () => {
    await renderWithI18n(<SyncStatusIndicator tournamentId="T" />);

    expect(screen.queryByTestId('sync-awaiting-server-copy')).toBeNull();
  });

  it('Gegenbeispiel @FU-109 je Turnier: wartet ein anderes Turnier, zeigt der Kopf dieses Turniers keinen Hinweis', async () => {
    hoisted.sync.awaitingServerCopyIds = ['ANDERES'];
    await renderWithI18n(<SyncStatusIndicator tournamentId="T" />);

    expect(screen.queryByTestId('sync-awaiting-server-copy')).toBeNull();
  });
});
