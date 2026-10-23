/**
 * @HE-110 im Mehr-Menü der mobilen Turnier-Navigation (ManagementMobileNav): „Meine Turniere auf diesem Handy“ nur mit
 * Helfer-Zugang zu diesem Turnier und eigenem Turnier auf dem Gerät; Tipp → Startseite. Gegenbeispiele ohne eines von beiden.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import { ManagementMobileNav } from '../../../screens/ManagementChrome';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { clearHelperAccessIndex, upsertHelperAccessEntry } from '../helperAccessStore';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../components/layout/AuthSection', () => ({ AuthSection: () => null }));

const listForCurrentUser = vi.fn<() => Promise<Array<{ id: string }>>>();
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

function renderNav() {
  render(
    <AuthContext.Provider value={{ user: { id: 'anon-tom', isAnonymous: true } } as unknown as AuthContextValue}>
      <MemoryRouter initialEntries={['/tournament/t-cup/live']}>
        <Routes>
          <Route path="*" element={<><ManagementMobileNav activeTab="management" onTabChange={() => undefined} tournamentId="t-cup" /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('@HE-110 „Mehr“ der mobilen Navigation', () => {
  it('Helfer-Zugang und eigenes Trainingsturnier → Punkt im Menü; Tipp führt zur Startseite und schließt das Menü', async () => {
    upsertHelperAccessEntry('anon-tom', cup());
    listForCurrentUser.mockResolvedValue([{ id: 't-cup' }, { id: 't-training' }]);
    renderNav();
    await userEvent.click(screen.getByTestId('bottom-nav-more'));
    const punkt = await screen.findByTestId('mehr-meine-turniere');
    expect(punkt.textContent).toBe('Meine Turniere auf diesem Handy');
    await userEvent.click(punkt);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });

  it('Gegenbeispiel: kein eigenes Turnier → Menü ohne diesen Punkt (Teams, Einstellungen, Monitor bleiben)', async () => {
    upsertHelperAccessEntry('anon-tom', cup());
    listForCurrentUser.mockResolvedValue([{ id: 't-cup' }]);
    renderNav();
    await userEvent.click(screen.getByTestId('bottom-nav-more'));
    expect(await screen.findByText('Einstellungen')).toBeTruthy();
    await waitFor(() => expect(listForCurrentUser).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('mehr-meine-turniere')).toBeNull();
  });

  it('Gegenbeispiel: kein Helfer-Zugang zu diesem Turnier → kein Punkt', async () => {
    listForCurrentUser.mockResolvedValue([{ id: 't-training' }]);
    renderNav();
    await userEvent.click(screen.getByTestId('bottom-nav-more'));
    expect(await screen.findByText('Einstellungen')).toBeTruthy();
    expect(screen.queryByTestId('mehr-meine-turniere')).toBeNull();
  });
});
