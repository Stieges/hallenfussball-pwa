/**
 * @HE-110 Vom Feld aus erreicht Tom seine eigenen Turniere über „Mehr“: Punkt „Meine Turniere auf diesem Handy“ im Blatt
 * „Mehr“ des Cockpits; Tipp → Startseite. Gegenbeispiele: ohne eigene Turniere fehlt der Punkt; ohne Helfer-Zugang auch.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import { MoreSheet } from '../../../components/live-cockpit/areas/MoreSheet';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { clearHelperAccessIndex, upsertHelperAccessEntry } from '../helperAccessStore';
import { hasOwnTournamentsBesidesHelper } from '../useOwnTournamentsOffer';

vi.unmock('i18next');
vi.unmock('react-i18next');

const listForCurrentUser = vi.fn<() => Promise<Array<{ id: string; deletedAt?: string }>>>();
vi.mock('../../../hooks/useRepository', () => ({ useRepository: () => ({ listForCurrentUser }) }));

beforeAll(async () => { await initRealDeI18n(); });

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => memory.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { memory.set(key, value); });
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => { memory.delete(key); });
  clearHelperAccessIndex();
  listForCurrentUser.mockReset();
});

const cup = (): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T08:00:00Z',
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderSheet(anonymous = true) {
  const onClose = vi.fn();
  render(
    <AuthContext.Provider value={{ user: { id: 'anon-tom', isAnonymous: anonymous } } as unknown as AuthContextValue}>
      <MemoryRouter initialEntries={['/tournament/t-cup/live?f=2']}>
        <Routes>
          <Route path="*" element={<><MoreSheet isOpen onClose={onClose} punkte={['einstellungen']} aktionen={{ einstellungen: () => undefined }} tournamentId="t-cup" /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { onClose };
}

describe('@HE-110 „Meine Turniere auf diesem Handy“', () => {
  it('Helfer-Zugang und ein eigenes Trainingsturnier → Punkt steht in „Mehr“; Tipp führt zur Startseite', async () => {
    upsertHelperAccessEntry('anon-tom', cup());
    listForCurrentUser.mockResolvedValue([{ id: 't-cup' }, { id: 't-training' }]);
    const { onClose } = renderSheet();
    const punkt = await screen.findByTestId('mehr-meine-turniere');
    expect(punkt.textContent).toBe('Meine Turniere auf diesem Handy');
    await userEvent.click(punkt);
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });

  it('Gegenbeispiel: kein eigenes Turnier auf dem Handy (nur das Helfer-Turnier) → „Mehr“ zeigt den Punkt nicht', async () => {
    upsertHelperAccessEntry('anon-tom', cup());
    listForCurrentUser.mockResolvedValue([{ id: 't-cup' }]);
    renderSheet();
    await waitFor(() => expect(listForCurrentUser).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('mehr-meine-turniere')).toBeNull();
  });

  it('Gegenbeispiel: nur ein Turnier im Papierkorb → kein Punkt', () => {
    expect(hasOwnTournamentsBesidesHelper([{ id: 'alt', deletedAt: '2026-11-01T00:00:00Z' }], new Set())).toBe(false);
    expect(hasOwnTournamentsBesidesHelper([{ id: 'alt' }], new Set(['alt']))).toBe(false);
    expect(hasOwnTournamentsBesidesHelper([{ id: 'alt' }], new Set())).toBe(true);
  });

  it('Gegenbeispiel: Gerät ohne Helfer-Zugang zu diesem Turnier → kein Punkt, keine Abfrage', async () => {
    listForCurrentUser.mockResolvedValue([{ id: 't-training' }]);
    renderSheet();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('mehr-meine-turniere')).toBeNull();
    expect(listForCurrentUser).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Konto angemeldet (keine Gerätesitzung) → kein Punkt', async () => {
    upsertHelperAccessEntry('anon-tom', cup());
    listForCurrentUser.mockResolvedValue([{ id: 't-training' }]);
    renderSheet(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('mehr-meine-turniere')).toBeNull();
  });
});
