/**
 * A-06i (Brief A10, @FU-013 / @FU-004): Anzeige "N Eintraege warten – kein Internet" bzw.
 * "– Uebertragung gestoert" statt ✓ bei wartenden Eintraegen.
 *
 * Echte i18next-Instanz (DE und EN) statt des globalen Passthrough-Mocks aus src/test/setup.ts,
 * der count/Plural ignoriert (Muster: placementLogicTestHelpers.tsx).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { SyncStatusBar } from '../SyncStatusBar';
import { deriveWaitReason } from '../syncStatusDisplay';

vi.unmock('i18next');
vi.unmock('react-i18next');

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

describe('SyncStatusBar — wartende Eintraege (A-06i, DE)', () => {
  it('8 wartende Eintraege ohne Problem am Ende der Verbindung: "kein Internet", kein "Synchronisiert"', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={8} waitReason="noInternet" />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('aria-label', '8 Einträge warten – kein Internet');
    expect(button).not.toHaveAttribute('aria-label', 'Synchronisiert');
    expect(button).toHaveAttribute('data-state', 'idle');
    expect(button).toHaveAttribute('data-pending', '8');
  });

  it('1 wartender Eintrag: Singularform', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={1} waitReason="noInternet" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', '1 Eintrag wartet – kein Internet');
  });

  it('disturbed: "Übertragung gestört" und der Detailtext im Titel', async () => {
    await renderWithI18n(
      <SyncStatusBar status="synced" pendingCount={2} waitReason="disturbed" waitDetail="Serverfehler X" />,
    );
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('aria-label', '2 Einträge warten – Übertragung gestört');
    expect(button).toHaveAttribute('title', '2 Einträge warten – Übertragung gestört – Serverfehler X');
  });

  it('noInternet zeigt den Detailtext NICHT im Titel', async () => {
    await renderWithI18n(
      <SyncStatusBar status="synced" pendingCount={2} waitReason="noInternet" waitDetail="Zeitlimit" />,
    );
    expect(screen.getByTestId('sync-status')).not.toHaveAttribute('title', expect.stringContaining('Zeitlimit'));
  });

  it('Pflichttest § 7: permanent, pending 1, failed 0 -> "1 Eintrag wartet – Übertragung gestört"', async () => {
    const waitReason = deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: null, queueFailure: 'permanent' });
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={1} failedCount={0} waitReason={waitReason} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', '1 Eintrag wartet – Übertragung gestört');
  });

  it('Fixpunkt A-06j: im Wartezustand (nicht kompakt) kein Inline-Text "ausstehend" und kein Titel-Zusatz', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={8} waitReason="noInternet" />);
    expect(screen.queryByText(/ausstehend/)).not.toBeInTheDocument();
    expect(screen.getByTestId('sync-status')).not.toHaveAttribute('title', expect.stringContaining('ausstehend'));
  });

  it('ohne waitReason: neutraler Text "N Einträge warten"', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={2} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', '2 Einträge warten');
  });

  it('Gegenbeispiel: pendingCount=0 bleibt "Synchronisiert"', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={0} waitReason="noInternet" />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('aria-label', 'Synchronisiert');
    expect(button).toHaveTextContent('✓');
  });

  it('Gegenbeispiel: failedCount>0 hat Vorrang vor dem Wartezustand', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={3} failedCount={1} waitReason="noInternet" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', 'Fehler');
  });

  it('Gegenbeispiel: status conflict bleibt Konflikt', async () => {
    await renderWithI18n(<SyncStatusBar status="conflict" pendingCount={3} waitReason="noInternet" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', 'Konflikt');
  });

  it('Gegenbeispiel: offline + 3 wartend -> data-state bleibt offline, Text "kein Internet"', async () => {
    await renderWithI18n(<SyncStatusBar status="offline" pendingCount={3} waitReason="noInternet" />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('data-state', 'offline');
    expect(button).toHaveAttribute('aria-label', '3 Einträge warten – kein Internet');
  });

  it('Synchronisieren hat Vorrang vor dem Wartezustand', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" isSyncing pendingCount={3} waitReason="noInternet" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', 'Wird synchronisiert...');
  });
});

describe('SyncStatusBar — wartende Eintraege (A-06i, EN)', () => {
  it('pluralisiert EN: 1 und 8 Eintraege', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={1} waitReason="noInternet" />, 'en');
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', '1 entry waiting – no internet');
  });

  it('EN Plural und disturbed-Text', async () => {
    await renderWithI18n(<SyncStatusBar status="synced" pendingCount={8} waitReason="disturbed" />, 'en');
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-label', '8 entries waiting – transmission disrupted');
  });
});
