/**
 * @W2A-077 (Record `2026-09-27_wizard-regelinhalte`, R2 PR 1): Nach Ollis eigener Gleichstands-Entscheidung wird ein Speichern
 * aus einer älteren Ansicht nicht übernommen; Grund „Nicht übernommen: Der Stand hat sich inzwischen durch deine eigene
 * Entscheidung geändert“, kein anderes Gerät. Das Merkmal `ownDecision` setzt die Warteschlange
 * (`OfflineRepository.eigeneEntscheidung.test.ts`). Gegenbeispiel @FU-108: ohne Merkmal bleibt „anderes Gerät“.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { SyncFailedList } from '../SyncFailedList';
import type { FailedMutationItem } from '../../../../core/services/MutationQueue';

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

function eintrag(overrides: Partial<FailedMutationItem>): FailedMutationItem {
  return {
    id: 'dl-1',
    type: 'SAVE_TOURNAMENT',
    payload: { id: 'T', changeRevision: 3 }, // Turnier ist beim Server (Änderungszählung der Cloud)
    timestamp: 1000,
    retryCount: 5,
    failedAt: 2000,
    lastError: 'Turnier wurde zwischenzeitlich verändert. Bitte neu laden.',
    ...overrides,
  };
}

describe('@W2A-077 Grund nach der eigenen Entscheidung', () => {
  it('@W2A-077 Konflikt aus der eigenen Entscheidung: Grund nennt die eigene Entscheidung und kein anderes Gerät; nur „Verwerfen und aktuellen Stand laden“', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ conflict: true, ownDecision: true })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    const grund = screen.getByTestId('sync-failed-reason-dl-1').textContent;
    expect(grund).toBe('Nicht übernommen: Der Stand hat sich inzwischen durch deine eigene Entscheidung geändert');
    expect(grund).not.toContain('Gerät');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
  });

  it('@W2A-077 auf Englisch übersetzt (Sprachparität)', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ conflict: true, ownDecision: true })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />, 'en');

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Not applied: the state has since changed through your own decision');
  });

  it('@FU-108 Gegenbeispiel: Konflikt ohne Merkmal bleibt „anderes Gerät“', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ conflict: true })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Turnier wurde inzwischen auf einem anderen Gerät geändert');
  });
});
