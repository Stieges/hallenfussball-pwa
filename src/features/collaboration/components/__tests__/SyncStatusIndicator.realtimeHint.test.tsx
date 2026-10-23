/**
 * A-06k (@FU-025): Ist der Realtime-Kanal des Turniers unterbrochen, zeigt der Indikator (Cockpit-
 * und Admin-Kopf) den Hinweis „Live-Verbindung unterbrochen“. Echte i18next-Instanz (DE/EN).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { emptyOutboxStatus } from '../../../../core/match/client/outboxTypes';
import { setRealtimeChannelStatus, clearRealtimeChannelStatus } from '../../../../hooks/realtimeChannelStatus';

const EMPTY_OUTBOX = emptyOutboxStatus();
const TOURNAMENT = 't-realtime-hint';

vi.unmock('i18next');
vi.unmock('react-i18next');

const hoisted = vi.hoisted(() => ({
  sync: {
    status: 'synced',
    isSyncing: false,
    pendingChanges: 0,
    failedChanges: 0,
    failedMutations: [] as never[],
    isCloudSyncAvailable: true,
    queueLastFailure: null as 'transient' | 'permanent' | 'storage' | null,
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

describe('SyncStatusIndicator — Hinweis „Live-Verbindung unterbrochen“ (A-06k, @FU-025)', () => {
  beforeEach(() => {
    hoisted.sync.isCloudSyncAvailable = true;
    hoisted.sync.pendingChanges = 0;
    hoisted.sync.failedChanges = 0;
  });

  afterEach(() => {
    clearRealtimeChannelStatus(TOURNAMENT);
  });

  it('CLOSED zeigt den Hinweis in DE', async () => {
    setRealtimeChannelStatus(TOURNAMENT, 'CLOSED');
    await renderWithI18n(<SyncStatusIndicator tournamentId={TOURNAMENT} />);

    expect(screen.getByTestId('realtime-interrupted-hint')).toHaveTextContent('Live-Verbindung unterbrochen');
  });

  it('CHANNEL_ERROR zeigt den Hinweis auf Englisch, wenn die Sprache EN ist', async () => {
    setRealtimeChannelStatus(TOURNAMENT, 'CHANNEL_ERROR');
    await renderWithI18n(<SyncStatusIndicator tournamentId={TOURNAMENT} />, 'en');

    expect(screen.getByTestId('realtime-interrupted-hint')).toHaveTextContent('Live connection interrupted');
  });

  it('Gegenbeispiel SUBSCRIBED: kein Hinweis', async () => {
    setRealtimeChannelStatus(TOURNAMENT, 'SUBSCRIBED');
    await renderWithI18n(<SyncStatusIndicator tournamentId={TOURNAMENT} />);

    expect(screen.queryByTestId('realtime-interrupted-hint')).toBeNull();
  });

  it('Gegenbeispiel kein Status gemeldet: kein Hinweis', async () => {
    await renderWithI18n(<SyncStatusIndicator tournamentId={TOURNAMENT} />);

    expect(screen.queryByTestId('realtime-interrupted-hint')).toBeNull();
  });

  it('Gegenbeispiel Gast (keine Cloud-Synchronisation): nichts wird gerendert, auch nicht bei CLOSED', async () => {
    hoisted.sync.isCloudSyncAvailable = false;
    setRealtimeChannelStatus(TOURNAMENT, 'CLOSED');
    await renderWithI18n(<SyncStatusIndicator tournamentId={TOURNAMENT} />);

    expect(screen.queryByTestId('realtime-interrupted-hint')).toBeNull();
  });
});
