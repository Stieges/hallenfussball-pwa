/**
 * Review TB-6 / CI Cloud-E2E: der Abschnitt „Gleichstand“ in den Einstellungen darf keine zweite Taste „Speichern“ oder
 * „Zurücksetzen“ bringen – die Cloud-Specs suchen `getByRole('button', { name: 'Speichern' })` und scheiterten an zwei
 * Treffern (strict mode). Echte deutsche Texte, Metadaten-Formular aufgeklappt.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import { i18nWrapper } from '../standings/__tests__/tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));
vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ tournaments: [], loading: false, saveTournament: vi.fn(), deleteTournament: vi.fn(), softDeleteTournament: vi.fn(), restoreTournament: vi.fn(), permanentDeleteTournament: vi.fn() }),
}));

import { SettingsTab } from '../SettingsTab';

const turnier = {
  id: 't1', title: 'Wintercup', status: 'published', teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [{ id: 'm1', matchStatus: 'scheduled' }], startDate: '2026-03-01', startTime: '10:00', ageClass: 'U11',
  location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [],
} as unknown as Tournament;

describe('SettingsTab: Abschnitt Gleichstand und die Tasten der Einstellungen', () => {
  it('genau eine Taste „Speichern“ und eine „Zurücksetzen“ (die des Formulars); der Abschnitt hat eigene Namen; ohne Speicherweg fehlt er ganz', async () => {
    const Wrapper = await i18nWrapper('de');
    const { unmount } = render(<Wrapper><SettingsTab tournament={turnier} onTournamentUpdate={vi.fn()} onSavePlayOutPlaces={vi.fn()} /></Wrapper>);
    await userEvent.click(screen.getByText('Metadaten bearbeiten', { exact: false }));
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Zurücksetzen' })).toHaveLength(1);
    expect(screen.getByTestId('playout-save')).toHaveAccessibleName('Plätze übernehmen');
    unmount();
    render(<Wrapper><SettingsTab tournament={turnier} onTournamentUpdate={vi.fn()} /></Wrapper>);
    expect(screen.queryByTestId('playout-settings')).toBeNull(); // Gegenbeispiel
  });
});
