/**
 * A-06j (Brief A10): Der Indikator verdrahtet den echten Ausgangs-Status (useOutboxStatus) und
 * die Queue-Fehlerklasse (useSyncStatus.queueLastFailure) in deriveWaitReason -> SyncStatusBar.
 *
 * Echte i18next-Instanz (DE), damit die Texte wie in der App erscheinen (kein Passthrough-Mock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { emptyOutboxStatus, type OutboxStatus } from '../../../../core/match/client/outboxTypes';

// Stabile Referenz: useSyncExternalStore verlangt gleichbleibende Snapshots.
const EMPTY_OUTBOX = emptyOutboxStatus();

vi.unmock('i18next');
vi.unmock('react-i18next');

const hoisted = vi.hoisted(() => ({
  outbox: null as OutboxStatus | null,
  sync: {
    status: 'synced',
    isSyncing: false,
    pendingChanges: 0,
    failedChanges: 0,
    failedMutations: [] as never[],
    isCloudSyncAvailable: true,
    queueLastFailure: null as 'transient' | 'permanent' | null,
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
      getStatus: () => hoisted.outbox ?? EMPTY_OUTBOX,
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

function outboxWith(partial: Partial<OutboxStatus>): OutboxStatus {
  return { ...emptyOutboxStatus(), ...partial };
}

describe('SyncStatusIndicator — Wartegrund aus Outbox und Queue (A-06j, DE)', () => {
  beforeEach(() => {
    hoisted.outbox = EMPTY_OUTBOX;
    hoisted.sync.status = 'synced';
    hoisted.sync.isSyncing = false;
    hoisted.sync.pendingChanges = 0;
    hoisted.sync.failedChanges = 0;
    hoisted.sync.failedMutations = [];
    hoisted.sync.isCloudSyncAvailable = true;
    hoisted.sync.queueLastFailure = null;
  });

  it('transienter Fehler der Ausgangs-Queue zeigt "kein Internet", nicht "gestört"', async () => {
    hoisted.sync.pendingChanges = 1;
    hoisted.outbox = outboxWith({ pendingByTournament: { t1: 1 }, lastFailureKind: 'transient' });
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('aria-label', '1 Eintrag wartet – kein Internet');
    expect(button).not.toHaveAttribute('title', expect.stringContaining('gestört'));
  });

  it('dauerhafter Fehler zeigt "Übertragung gestört" und den Serverfehler im Titel', async () => {
    hoisted.sync.pendingChanges = 2;
    hoisted.outbox = outboxWith({
      pendingByTournament: { t1: 2 },
      lastFailureKind: 'permanent',
      lastError: 'Serverfehler X',
    });
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('aria-label', '2 Einträge warten – Übertragung gestört');
    expect(button).toHaveAttribute('title', expect.stringContaining('Serverfehler X'));
  });

  it('Paragraf 7 Ende-zu-Ende: Queue-Fehler "permanent" beim ersten Fehlversuch, pending 1, failed 0', async () => {
    hoisted.sync.pendingChanges = 1;
    hoisted.sync.failedChanges = 0;
    hoisted.sync.queueLastFailure = 'permanent';
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute(
      'aria-label',
      '1 Eintrag wartet – Übertragung gestört',
    );
  });
});
