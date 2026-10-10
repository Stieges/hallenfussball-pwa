/**
 * A-06j (Brief A10): Der Indikator verdrahtet den echten Ausgangs-Status (useOutboxStatus) und
 * die Queue-Fehlerklasse (useSyncStatus.queueLastFailure) in deriveWaitReason -> SyncStatusBar.
 *
 * Echte i18next-Instanz (DE), damit die Texte wie in der App erscheinen (kein Passthrough-Mock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { emptyOutboxStatus, type OutboxStatus } from '../../../../core/match/client/outboxTypes';
import { cssVars } from '../../../../design-tokens';

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
  const wrap = (node: ReactElement) => <I18nextProvider i18n={instance}>{node}</I18nextProvider>;
  const result = render(wrap(ui));
  return { ...result, rerender: (node: ReactElement) => result.rerender(wrap(node)) };
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

describe('SyncStatusIndicator — Antippen zeigt Wartedetails (A-06j, DE)', () => {
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

  it('Pflichttest: Antippen zeigt "Übertragung gestört" und den Serverfehler im Detail-Feld', async () => {
    hoisted.sync.pendingChanges = 2;
    hoisted.outbox = outboxWith({
      pendingByTournament: { t1: 2 },
      lastFailureKind: 'permanent',
      lastError: 'Serverfehler X',
    });
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));

    const details = screen.getByTestId('sync-wait-details');
    expect(details).toHaveTextContent('2 Einträge warten – Übertragung gestört');
    expect(details).toHaveTextContent('Serverfehler X');
  });

  it('Gegenbeispiel: ohne Antippen erscheint kein Detail-Feld', async () => {
    hoisted.sync.pendingChanges = 2;
    hoisted.outbox = outboxWith({ pendingByTournament: { t1: 2 }, lastFailureKind: 'permanent', lastError: 'Serverfehler X' });
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);

    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne wartende Eintraege oeffnet Antippen kein Wartefeld', async () => {
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));

    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: transienter Fehler zeigt im Detail "kein Internet", nicht "gestört"', async () => {
    hoisted.sync.pendingChanges = 1;
    hoisted.outbox = outboxWith({ pendingByTournament: { t1: 1 }, lastFailureKind: 'transient', lastError: 'Netzwerkfehler' });
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));

    const details = screen.getByTestId('sync-wait-details');
    expect(details).toHaveTextContent('1 Eintrag wartet – kein Internet');
    expect(details).not.toHaveTextContent('gestört');
  });

  it('Schliesst sich per Klick ausserhalb wie die Fehlerliste', async () => {
    hoisted.sync.pendingChanges = 1;
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(screen.getByTestId('sync-wait-details')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();
  });

  it('Fix 1: gemerkter Offen-Zustand wird zurueckgesetzt, wenn die Warteschlange leer ist', async () => {
    hoisted.sync.pendingChanges = 2;
    hoisted.outbox = outboxWith({ pendingByTournament: { t1: 2 }, lastFailureKind: 'permanent', lastError: 'Serverfehler X' });
    const view = await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(screen.getByTestId('sync-wait-details')).toBeInTheDocument();

    hoisted.sync.pendingChanges = 0;
    hoisted.outbox = EMPTY_OUTBOX;
    view.rerender(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();

    hoisted.sync.pendingChanges = 1;
    hoisted.outbox = outboxWith({ pendingByTournament: { t1: 1 }, lastFailureKind: 'permanent', lastError: 'Serverfehler X' });
    view.rerender(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();
  });

  it('Fix 1: gemerkter Offen-Zustand wird zurueckgesetzt, wenn fehlgeschlagene Eintraege auftauchen', async () => {
    hoisted.sync.pendingChanges = 1;
    const view = await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(screen.getByTestId('sync-wait-details')).toBeInTheDocument();

    hoisted.sync.failedChanges = 1;
    view.rerender(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();

    hoisted.sync.failedChanges = 0;
    view.rerender(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();
  });

  it('Fix 2: Detailtext des Wartefelds nutzt die Warnfarbe, nicht die Fehlerfarbe', async () => {
    hoisted.sync.pendingChanges = 2;
    hoisted.outbox = outboxWith({ pendingByTournament: { t1: 2 }, lastFailureKind: 'permanent', lastError: 'Serverfehler X' });
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);
    fireEvent.click(screen.getByTestId('sync-status'));

    const detail = screen.getByText('Serverfehler X');
    expect(detail).toHaveStyle({ color: cssVars.colors.warning });
    expect(detail).not.toHaveStyle({ color: cssVars.colors.error });
  });

  it('bei fehlgeschlagenen Eintraegen bleibt die Fehlerliste, kein Wartefeld', async () => {
    hoisted.sync.pendingChanges = 1;
    hoisted.sync.failedChanges = 1;
    await renderWithI18n(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));

    expect(screen.getByTestId('sync-failed-list')).toBeInTheDocument();
    expect(screen.queryByTestId('sync-wait-details')).not.toBeInTheDocument();
  });
});

