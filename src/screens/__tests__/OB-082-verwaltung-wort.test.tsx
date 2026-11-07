/**
 * @OB-082 Der Weg in die Verwaltung des Turniers ist am Handy beschriftet: am Zahnrad steht das Wort „Verwaltung“, nicht nur ein
 * Symbol, und ein Tipp darauf öffnet die Verwaltung. Mit echten deutschen Texten; die Pixelmessung (360×640) ist visual:metrics.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import deTournament from '../../i18n/locales/de/tournament.json';
import type { Tournament } from '../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null }));

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { ManagementHeader } = await import('../ManagementChrome');

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de', fallbackLng: 'de', defaultNS: 'tournament', ns: ['tournament'],
    resources: { de: { tournament: deTournament } }, interpolation: { escapeValue: false },
  });
});

const tournament = { id: 'ost', title: 'Hallencup Ost', date: '2026-11-28', teams: [], matches: [] } as unknown as Tournament;

function kopf(isMobile: boolean) {
  return render(
    <MemoryRouter initialEntries={['/tournament/ost/schedule']}>
      <Routes>
        <Route path="/tournament/ost/schedule" element={
          <ManagementHeader tournament={tournament} isMobile={isMobile} activeTab="schedule" isSettingsDirty={false} onTabChange={vi.fn()}
            onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
        } />
        <Route path="/tournament/ost/admin" element={<p>Verwaltung geöffnet</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('@OB-082 Zahnrad am Handy mit dem Wort „Verwaltung“', () => {
  it('am Handy steht am Zahnrad das Wort „Verwaltung“, nicht nur ein Symbol', () => {
    kopf(true);
    const knopf = screen.getByTestId('management-admin-entry');
    expect(knopf).toHaveTextContent('⚙️');
    expect(knopf).toHaveTextContent('Verwaltung');
  });

  it('ein Tipp darauf öffnet die Verwaltung des Turniers', () => {
    kopf(true);
    fireEvent.click(screen.getByTestId('management-admin-entry'));
    expect(screen.getByText('Verwaltung geöffnet')).toBeInTheDocument();
  });
});
