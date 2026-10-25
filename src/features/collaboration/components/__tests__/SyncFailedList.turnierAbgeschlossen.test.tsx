/**
 * R3-2a (@HE-070 Z. 1, @FU-057 Z. 1, @LZ-038, @FU-126): Ein Eintrag, den der Server nach dem Abschluss abgelehnt hat (Merkmal
 * `rejection: 'tournamentFinished'`), zeigt „Nicht übernommen – Turnier ist abgeschlossen“ statt des technischen Fehlertexts und
 * bietet kein „Erneut versuchen“ (der Server lehnt wieder gleich ab), nur „Verwerfen und aktuellen Stand laden“ (Server-Stand
 * übernehmen). Gegenbeispiel: ein Eintrag ohne Grund behält „Erneut versuchen“. Echte i18next-Instanz (DE/EN).
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
    type: 'UPDATE_MATCHES',
    payload: { tournamentId: 'live-cup', updates: [{ id: 'finale' }] },
    timestamp: 1000,
    retryCount: 0,
    failedAt: 2000,
    lastError: 'Match finale: TOURNAMENT_FINISHED: Turnier ist abgeschlossen (matches, Turnier live-cup).',
    ...overrides,
  };
}

describe('R3-2a Liste gestörter Übertragungen: „nicht übernommen – Turnier ist abgeschlossen“ (@HE-070, @FU-057, @FU-126)', () => {
  it('@HE-070 @FU-057 Grund in Klartext, kein „Erneut versuchen“, Verwerfen übernimmt den Stand des Servers', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ rejection: 'tournamentFinished' })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Nicht übernommen – Turnier ist abgeschlossen');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
    expect(screen.getByTestId('sync-discard-dl-1').textContent).toBe('Verwerfen und aktuellen Stand laden');
  });

  it('@HE-070 auf Englisch', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ rejection: 'tournamentFinished' })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />, 'en');

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Not accepted – the tournament is finished');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
  });

  it('@FU-127 Gegenbeispiel: ohne Grund bleibt der letzte Fehler und „Erneut versuchen“', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ lastError: 'permission denied' })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('permission denied');
    expect(screen.getByTestId('sync-retry-dl-1')).toBeTruthy();
  });
});
