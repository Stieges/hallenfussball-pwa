/**
 * BP-1 – Befund C-ENDGUELTIG-SOFORT-MELDEN, Szenario @FU-126 (Anzeige „nicht übernommen“ mit Grund).
 * Ein vom Server eindeutig abgelehnter Eintrag (Merkmal `rejection: 'invalidValue'`) zeigt „Nicht übernommen – ungültiger Wert“
 * (Glossar: „nicht übernommen“, nicht „abgelehnt“) statt des technischen Fehlertexts und bietet kein „Erneut versuchen“ (es scheiterte wieder gleich).
 * Gegenbeispiel: ein Eintrag ohne Merkmal (unklarer Grund) zeigt den letzten Fehler und behält „Erneut versuchen“.
 * Echte i18next-Instanz (DE/EN).
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
    payload: { id: 'T' },
    timestamp: 1000,
    retryCount: 0,
    failedAt: 2000,
    lastError: 'duplicate key value violates unique constraint "teams_tournament_id_name_key"',
    ...overrides,
  };
}

describe('@FU-126 Liste gestörter Übertragungen: eindeutige Ablehnung mit Grund (Befund C-ENDGUELTIG-SOFORT-MELDEN)', () => {
  it('@FU-126 ungültiger Wert: Grund in Klartext, kein „Erneut versuchen“, Verwerfen lädt den aktuellen Stand', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ rejection: 'invalidValue' })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Nicht übernommen – ungültiger Wert');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
    expect(screen.getByTestId('sync-discard-dl-1').textContent).toBe('Verwerfen und aktuellen Stand laden');
  });

  it('@FU-126 ungültiger Wert auf Englisch', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ rejection: 'invalidValue' })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />, 'en');

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Not accepted – invalid value');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
  });

  it('@FU-127 Gegenbeispiel: ohne Merkmal (unklarer Grund) bleiben letzter Fehler und „Erneut versuchen“', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ lastError: 'Something went wrong' })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Something went wrong');
    expect(screen.getByTestId('sync-retry-dl-1')).toBeTruthy();
  });
});
