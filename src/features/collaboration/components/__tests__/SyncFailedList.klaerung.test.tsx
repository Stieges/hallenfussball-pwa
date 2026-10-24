/**
 * A-15c (@W2A-062, @TM-146, @TM-147, @TM-116 Z1): Ein ohne Netz abgeschlossener Abschluss, den der Server wegen einer
 * Änderung am Server nicht übernommen hat, steht auf Ollis Gerät heute in der Liste gestörter Übertragungen als
 * „Klärung nötig“ – mit Entscheidung „Abschluss und Entscheidung“. Kein „Erneut versuchen“ (es scheiterte wieder gleich),
 * „Verwerfen und aktuellen Stand laden“ bleibt. Gegenbeispiel: ein Konflikt einer Speicherung behält seinen Text.
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
    lng, fallbackLng: 'de', defaultNS: 'common', ns: ['common'],
    resources: { de: { common: deCommon }, en: { common: enCommon } },
    interpolation: { escapeValue: false }, returnNull: false,
  });
  return render(<I18nextProvider i18n={instance}>{ui}</I18nextProvider>);
}

const ENTSCHEIDUNG = { id: 'e-olli', groupId: 'A', teamIds: ['sued', 'west'], order: ['west', 'sued'], kind: 'shootout', shootout: { winner: 4, loser: 3 } };

function abschluss(tieDecisions: unknown[], knownDecisionIds: string[] = []): FailedMutationItem {
  return {
    id: 'dl-1', type: 'COMPLETE_GROUP', timestamp: 1000, retryCount: 0, failedAt: 2000, conflict: true,
    lastError: 'Gruppe abschließen: Klärung nötig (STALE_VERSION)',
    payload: { tournamentId: 'T', baseVersion: 5, request: { groupId: 'A', ranking: [], openRanks: [], tieDecisions, knownDecisionIds, expectedState: [], fromQueue: true } },
  };
}

const zeige = (item: FailedMutationItem, lng: 'de' | 'en' = 'de') =>
  renderWithI18n(<SyncFailedList items={[item]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />, lng);

describe('A-15c „Klärung nötig“ für einen nachgereichten Abschluss (@W2A-062, @TM-146, @TM-147)', () => {
  it('@TM-146 Z2 mit neuer Entscheidung: „Gruppe abschließen“, Klärung nötig – Abschluss und Entscheidung nicht übernommen; nur Verwerfen', async () => {
    await zeige(abschluss([ENTSCHEIDUNG]));
    expect(screen.getByText('Gruppe abschließen')).toBeTruthy();
    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent)
      .toBe('Klärung nötig: Am Server wurde die Gruppe inzwischen geändert oder anders entschieden. Abschluss und Entscheidung ohne Netz wurden nicht übernommen.');
    expect(screen.queryByTestId('sync-retry-dl-1')).toBeNull();
    expect(screen.getByTestId('sync-discard-dl-1').textContent).toBe('Verwerfen und aktuellen Stand laden');
  });

  it('@TM-116 Z1 ohne neue Entscheidung (bekannte Entscheidung zählt nicht): nur der Abschluss', async () => {
    await zeige(abschluss([ENTSCHEIDUNG], ['e-olli']));
    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent)
      .toBe('Klärung nötig: Am Server wurde die Gruppe inzwischen geändert. Der Abschluss ohne Netz wurde nicht übernommen.');
  });

  it('auf Englisch', async () => {
    await zeige(abschluss([ENTSCHEIDUNG]), 'en');
    expect(screen.getByText('Close group')).toBeTruthy();
    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toMatch(/^Needs clarification: /);
  });

  it('Gegenbeispiel: Konflikt einer Speicherung behält „Turnier wurde inzwischen auf einem anderen Gerät geändert“', async () => {
    await zeige({ ...abschluss([]), type: 'SAVE_TOURNAMENT', payload: { id: 'T' } });
    expect(screen.getByTestId('sync-failed-reason-dl-1').textContent).toBe('Turnier wurde inzwischen auf einem anderen Gerät geändert');
  });
});
