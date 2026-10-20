/**
 * @FU-108 (Befund C-WIEDERHOLEN-NACH-KONFLIKT-ENDLOS, `plattform/2026-09-24_fundament-gemeinsamer-stand.md`): Eine wegen eines
 * Konflikts abgelehnte Änderung (Merkmal `conflict` im Dead-Letter) zeigt „Turnier wurde inzwischen auf einem anderen Gerät
 * geändert“ und bietet statt „Erneut versuchen“ nur „Verwerfen und aktuellen Stand laden“ an. Gegenbeispiel: eine aus anderem
 * Grund abgelehnte Änderung behält „Erneut versuchen“. Echte i18next-Instanz (DE/EN).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    retryCount: 5,
    failedAt: 2000,
    lastError: 'Turnier wurde zwischenzeitlich verändert. Bitte neu laden.',
    ...overrides,
  };
}

describe('@FU-108 Liste gestörter Übertragungen bei einem Konflikt (Befund C-WIEDERHOLEN-NACH-KONFLIKT-ENDLOS)', () => {
  it('@FU-108 Konflikt: Hinweis „anderes Gerät“, kein „Erneut versuchen“, stattdessen „Verwerfen und aktuellen Stand laden“', async () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    await renderWithI18n(<SyncFailedList items={[eintrag({ conflict: true })]} onRetry={onRetry} onDiscard={onDiscard} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Turnier wurde inzwischen auf einem anderen Gerät geändert');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
    expect(screen.queryByText('Erneut versuchen')).toBeNull();
    const verwerfen = screen.getByTestId('sync-discard-dl-1');
    expect(verwerfen.textContent).toBe('Verwerfen und aktuellen Stand laden');

    fireEvent.click(verwerfen);
    expect(onDiscard).not.toHaveBeenCalled(); // Rückfrage zuerst
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onDiscard).toHaveBeenCalledWith('dl-1');
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('@FU-108 Konflikt auf Englisch: gleiche Bedienung, übersetzte Texte', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ conflict: true })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />, 'en');

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('The tournament has since been changed on another device');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
    expect(screen.getByTestId('sync-discard-dl-1').textContent).toBe('Discard and load current state');
  });

  it('Gegenbeispiel: ohne Konflikt (z. B. fehlende Berechtigung) bleiben Grund und „Erneut versuchen“', async () => {
    const onRetry = vi.fn();
    await renderWithI18n(<SyncFailedList items={[eintrag({ type: 'UPDATE_MATCH', lastError: 'RLS: keine Berechtigung' })]} onRetry={onRetry} onDiscard={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('RLS: keine Berechtigung');
    fireEvent.click(screen.getByTestId('sync-retry-dl-1'));
    expect(onRetry).toHaveBeenCalledWith('dl-1');
    expect(screen.getByTestId('sync-discard-dl-1').textContent).toBe('Verwerfen');
  });

  it('@FU-106 die Rückfrage vor dem Verwerfen sagt, dass danach der Stand des Servers gilt – auch ohne Verbindung', async () => {
    await renderWithI18n(<SyncFailedList items={[eintrag({ conflict: true })]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('sync-discard-dl-1'));

    expect(screen.getByText(/Das Gerät zeigt danach den aktuellen Stand des Servers – ohne Verbindung, sobald sie wieder besteht/)).toBeInTheDocument();
  });
});
